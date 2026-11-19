import React, { useState, useEffect, useRef } from 'react';
import { useDriverAuth } from '../context/AuthContext';
import {
  subscribeToCollection,
  subscribeToDocument,
  updateDocument,
  callFunction,
  arrayUnion,
  where,
  friendlyError,
} from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Delivery, DeliveryStatus, VendorOrder } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Spinner } from '@poeage/ui';
import {
  MapPin,
  Navigation,
  CheckCircle,
  Phone,
  ShieldCheck,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  KeyRound,
  RefreshCw,
  Truck,
  Store,
  Wallet,
  PackageCheck,
  Package,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, driver, isOnline, toggleAvailability } = useDriverAuth();
  const [loading, setLoading] = useState(true);
  const [otpInput, setOtpInput] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [assignedJobs, setAssignedJobs] = useState<Delivery[]>([]);
  const [openJobs, setOpenJobs] = useState<Delivery[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [jobError, setJobError] = useState<string | null>(null);
  const [vendorOrderStatus, setVendorOrderStatus] = useState<string | null>(null);

  // Live feed of my jobs plus unassigned jobs. The vendor packing the parcel or admin assigning a job
  // shows up here immediately.
  useEffect(() => {
    const driverId = driver?.id || user?.uid;
    if (!driverId) {
      setAssignedJobs([]);
      setOpenJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let ready = 0;
    const markReady = () => {
      ready += 1;
      if (ready >= 2) setLoading(false);
    };
    const onError = (err: Error) => {
      console.error('Could not load deliveries:', err);
      setJobError(friendlyError(err, 'Could not load your deliveries.'));
      setLoading(false);
    };
    const unsubMine = subscribeToCollection<Delivery>(
      COLLECTION.DELIVERIES,
      [where('driverId', '==', driverId)],
      (list) => {
        setAssignedJobs(list);
        markReady();
      },
      onError,
    );
    const unsubOpen = subscribeToCollection<Delivery>(
      COLLECTION.DELIVERIES,
      [where('status', '==', 'pending_assignment')],
      (list) => {
        setOpenJobs(list);
        markReady();
      },
      onError,
    );
    return () => {
      unsubMine();
      unsubOpen();
    };
  }, [driver?.id, user?.uid, reloadKey]);

  const deliveries = React.useMemo(() => {
    const seen = new Set<string>();
    return [...assignedJobs, ...openJobs].filter((d) => !seen.has(d.id) && seen.add(d.id));
  }, [assignedJobs, openJobs]);

  const fetchDeliveries = () => setReloadKey((k) => k + 1);

  // Find active job (not yet delivered)
  const activeJob = deliveries.find(
    (d) => d.status !== 'delivered' && (d.driverId === driver?.id || d.driverId === user?.uid)
  );

  // Is the parcel packed? The driver can only collect it once the seller marks it ready.
  const activeVendorOrderId = activeJob?.vendorOrderId;
  useEffect(() => {
    if (!activeVendorOrderId) {
      setVendorOrderStatus(null);
      return;
    }
    // The job shows up locally the instant it is accepted, slightly before the server has confirmed it, so
    // the first read can be refused. Retry a few times instead of giving up.
    let unsub: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let attempts = 0;
    const listen = () => {
      unsub = subscribeToDocument<VendorOrder>(
        COLLECTION.VENDOR_ORDERS,
        activeVendorOrderId,
        (vo) => setVendorOrderStatus(vo?.status ?? null),
        () => {
          setVendorOrderStatus(null);
          if (!cancelled && attempts < 6) {
            attempts += 1;
            timer = setTimeout(listen, 1500);
          }
        },
      );
    };
    listen();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsub?.();
    };
  }, [activeVendorOrderId]);
  const parcelReady = vendorOrderStatus === 'ready_for_pickup' || vendorOrderStatus === 'dispatched';

  const completedTrips = deliveries.filter((d) => d.status === 'delivered');
  const todayEarningsPaise = completedTrips.reduce((sum, d) => sum + (d.driverEarning || 0), 0);

  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // When the driver starts the delivery, bring the PIN box into view so they never have to hunt for it.
  const pinForm = useRef<HTMLFormElement>(null);
  const jobStatus = activeJob?.status;
  useEffect(() => {
    if (jobStatus === 'out_for_delivery' || jobStatus === 'in_transit') {
      const t = setTimeout(() => pinForm.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
      return () => clearTimeout(t);
    }
  }, [jobStatus]);
  const handleAcceptJob = async (job: Delivery) => {
    const myId = driver?.id || user?.uid;
    if (!myId) return;
    setAcceptingId(job.id);
    setJobError(null);
    try {
      await updateDocument(COLLECTION.DELIVERIES, job.id, {
        driverId: myId,
        driverName: driver?.displayName || 'Delivery Partner',
        status: 'driver_accepted',
        statusHistory: arrayUnion({
          status: 'driver_accepted',
          timestamp: new Date().toISOString(),
          note: 'Delivery partner accepted the job',
          actorId: user?.uid ?? '',
        }),
      });
    } catch (err: any) {
      console.error('Failed to accept job:', err);
      setJobError(
        err?.code === 'permission-denied'
          ? 'This job was just taken by another driver, or you are not online. Check your status and try again.'
          : friendlyError(err, 'Could not accept the job. Please try again.'),
      );
    } finally {
      setAcceptingId(null);
    }
  };

  const syncVendorOrder = async (status: 'dispatched' | 'delivered', note: string) => {
    if (!activeJob?.vendorOrderId) return;
    try {
      await updateDocument(COLLECTION.VENDOR_ORDERS, activeJob.vendorOrderId, {
        status,
        statusHistory: arrayUnion({
          status,
          timestamp: new Date().toISOString(),
          note,
          actorId: user?.uid ?? '',
        }),
      });
    } catch (err) {
      // The delivery itself is already saved; the customer's screen derives its status from it.
      console.warn('Could not sync seller order status:', err);
    }
  };

  const handleUpdateStatus = async (nextStatus: DeliveryStatus) => {
    if (!activeJob) return;
    setJobError(null);
    try {
      await updateDocument(COLLECTION.DELIVERIES, activeJob.id, {
        status: nextStatus,
        statusHistory: arrayUnion({
          status: nextStatus,
          timestamp: new Date().toISOString(),
          note: nextStatus === 'picked_up' ? 'Parcel collected from seller' : 'Out for delivery',
          actorId: user?.uid ?? '',
        }),
      });
      if (nextStatus === 'picked_up') {
        await syncVendorOrder('dispatched', 'Picked up by delivery partner');
      }
    } catch (err: any) {
      console.error('Failed to update delivery status:', err);
      setJobError(
        err?.code === 'permission-denied'
          ? 'The seller has not marked this parcel as ready yet. Please wait for them to finish packing.'
          : friendlyError(err, 'Could not update the delivery status. Please try again.'),
      );
    }
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeJob) return;

    if (!otpInput.trim()) {
      setOtpError('Please enter the 4-digit OTP provided by the customer.');
      return;
    }

    setOtpError(null);
    setVerifyingOtp(true);

    try {
      // 1. Try server-side Cloud Function
      try {
        await callFunction('confirmDelivery', {
          deliveryId: activeJob.id,
          otp: otpInput.trim(),
        });
      } catch (fnErr: any) {
        // No Cloud Functions on this plan: complete the job directly. Security rules compare the
        // PIN you typed with the customer's PIN, which drivers are never allowed to read.
        try {
          await updateDocument(COLLECTION.DELIVERIES, activeJob.id, {
            status: 'delivered',
            deliveredAt: new Date(),
            otpEntered: otpInput.trim(),
            statusHistory: arrayUnion({
              status: 'delivered',
              timestamp: new Date().toISOString(),
              note: 'Handed over to customer with PIN verification',
              actorId: user?.uid ?? '',
            }),
          });
        } catch (writeErr: any) {
          if (writeErr?.code === 'permission-denied') {
            throw new Error('Invalid OTP. Please ask the customer for their 4-digit code.');
          }
          throw writeErr;
        }

        await syncVendorOrder('delivered', 'Delivered to customer');
      }

      setSuccessNotice(`Delivery Confirmed! ${formatMoney(activeJob.driverEarning || 0)} added to your earnings.`);
      setOtpInput('');
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid delivery verification OTP.';
      setOtpError(msg);
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ----- presentation helpers -----
  const mapsLink = (a?: { line1?: string; city?: string; state?: string; pincode?: string; postalCode?: string } | undefined) => {
    const q = [a?.line1, a?.city, a?.state, a?.pincode ?? a?.postalCode].filter(Boolean).join(', ');
    return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
  };
  const stepOf = (status: string) =>
    status === 'delivered' ? 4 : ['out_for_delivery', 'in_transit'].includes(status) ? 3 : status === 'picked_up' ? 2 : 1;
  const STEPS = ['Accepted', 'Picked up', 'On the way', 'Delivered'];

  return (
    <div className="px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] space-y-4 max-w-xl mx-auto">
      {/* Availability */}
      {!isOnline ? (
        <div className="bg-amber-950/50 border border-amber-800/70 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-300 leading-tight">You are offline</p>
            <p className="text-xs text-slate-400 mt-0.5">Go online to see and accept delivery jobs.</p>
          </div>
          <Button onClick={toggleAvailability} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold h-10 px-4 text-sm flex-shrink-0">
            Go online
          </Button>
        </div>
      ) : (
        <div className="bg-green-950/40 border border-green-800/50 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-green-300 font-semibold text-sm min-w-0">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
            </span>
            <span className="truncate">Online · ready for jobs</span>
          </div>
          <button
            onClick={fetchDeliveries}
            aria-label="Refresh jobs"
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-green-300 bg-green-900/30 active:bg-green-900/60 flex-shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            <Wallet className="w-3.5 h-3.5 text-amber-400" /> Earnings
          </div>
          <p className="text-2xl font-black text-amber-400 mt-1 leading-none">{formatMoney(todayEarningsPaise)}</p>
          <p className="text-[11px] text-slate-500 mt-1.5">{completedTrips.length} {completedTrips.length === 1 ? 'trip' : 'trips'} completed</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            <PackageCheck className="w-3.5 h-3.5 text-emerald-400" /> Deliveries
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-1 leading-none">
            {(driver?.metadata?.totalDeliveries || 0) + completedTrips.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">Verified partner</p>
        </div>
      </div>

      {successNotice && (
        <div role="status" className="p-3.5 bg-emerald-950/80 border border-emerald-600/70 rounded-2xl text-emerald-200 text-sm flex items-center gap-2.5 animate-[slideUp_.25s_ease-out]">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="font-semibold">{successNotice}</span>
        </div>
      )}

      {/* Active job */}
      {activeJob ? (
        <section className="rounded-3xl border border-slate-800 bg-slate-900 shadow-xl">
          <div className="px-4 pt-4 pb-3 bg-slate-800/50 border-b border-slate-700/50 space-y-3 rounded-t-3xl">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-mono font-bold text-slate-400">JOB #{activeJob.id.slice(0, 8).toUpperCase()}</span>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 capitalize whitespace-nowrap">
                {activeJob.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-xs text-slate-400">You earn for this trip</span>
              <span className="text-2xl font-black text-amber-400 leading-none">{formatMoney(activeJob.driverEarning || 0)}</span>
            </div>

            {/* progress */}
            <ol className="flex items-center" aria-label="Delivery progress">
              {STEPS.map((label, i) => {
                const n = i + 1;
                const cur = stepOf(activeJob.status);
                const done = cur > n;
                const now = cur === n;
                return (
                  <li key={label} className="flex-1 flex flex-col items-center relative">
                    {i > 0 && (
                      <span className={`absolute top-[11px] right-1/2 w-full h-0.5 ${cur >= n ? 'bg-amber-500' : 'bg-slate-700'}`} />
                    )}
                    <span
                      className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                        done ? 'bg-amber-500 text-slate-950' : now ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/25' : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                    >
                      {done ? '\u2713' : n}
                    </span>
                    <span className={`mt-1.5 text-[10px] font-semibold ${cur >= n ? 'text-slate-200' : 'text-slate-500'}`}>{label}</span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="p-4 space-y-5">
            {/* Route */}
            <div className="space-y-4 relative border-l-2 border-dashed border-slate-700 ml-3 pl-5">
              <div className="relative">
                <span className="absolute -left-[29px] top-0.5 w-4 h-4 rounded-full bg-amber-500 border-[3px] border-slate-900" />
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Pickup</p>
                <p className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{activeJob.pickupAddress?.label || 'Pickup store'}</span>
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {[activeJob.pickupAddress?.line1, activeJob.pickupAddress?.city, activeJob.pickupAddress?.state].filter(Boolean).join(', ')}
                </p>
                {mapsLink(activeJob.pickupAddress) && (
                  <a
                    href={mapsLink(activeJob.pickupAddress)!}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-bold active:bg-amber-500/20"
                  >
                    <Navigation className="w-3.5 h-3.5" /> Navigate to store
                  </a>
                )}
              </div>

              <div className="relative">
                <span className="absolute -left-[29px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border-[3px] border-slate-900" />
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Drop-off</p>
                <p className="text-sm font-bold text-white mt-0.5">{activeJob.deliveryAddress?.recipientName}</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeJob.deliveryAddress?.line1}
                  {activeJob.deliveryAddress?.landmark && (
                    <span className="text-slate-400"> · Landmark: {activeJob.deliveryAddress.landmark}</span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {activeJob.deliveryAddress?.city}, {activeJob.deliveryAddress?.state} {activeJob.deliveryAddress?.pincode && `\u2013 ${activeJob.deliveryAddress.pincode}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeJob.deliveryAddress?.phone && (
                    <a
                      href={`tel:${activeJob.deliveryAddress.phone}`}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-bold active:bg-emerald-500/20"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call customer
                    </a>
                  )}
                  {mapsLink(activeJob.deliveryAddress) && (
                    <a
                      href={mapsLink(activeJob.deliveryAddress)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold active:bg-slate-700"
                    >
                      <Navigation className="w-3.5 h-3.5" /> Navigate
                    </a>
                  )}
                </div>
              </div>
            </div>

            {jobError && (
              <p className="text-xs text-red-300 bg-red-950/50 border border-red-900/60 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {jobError}
              </p>
            )}

            {/* Step actions */}
            {['assigned', 'driver_accepted', 'driver_at_vendor'].includes(activeJob.status) && (
              <div className="space-y-2.5">
                <div
                  className={`text-xs px-3.5 py-2.5 rounded-xl border flex items-start gap-2 ${
                    parcelReady ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300' : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                  }`}
                >
                  <Package className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {parcelReady ? 'Parcel is packed and ready for collection.' : 'Waiting for the seller to finish packing. You can collect it once it is marked ready.'}
                </div>
                <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-30 -mx-4 px-4 pt-4 pb-1 bg-gradient-to-t from-slate-900 from-70% to-transparent">
                <Button
                  onClick={() => handleUpdateStatus('picked_up')}
                  disabled={!parcelReady}
                  className="w-full h-14 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-base flex items-center justify-center gap-2 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Truck className="w-5 h-5" />
                  Picked up from store
                </Button>
                </div>
              </div>
            )}

            {activeJob.status === 'picked_up' && (
              <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-30 -mx-4 px-4 pt-4 pb-1 bg-gradient-to-t from-slate-900 from-70% to-transparent">
              <Button
                onClick={() => handleUpdateStatus('out_for_delivery')}
                className="w-full h-14 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold text-base flex items-center justify-center gap-2 rounded-2xl"
              >
                <Navigation className="w-5 h-5" />
                Start delivery
              </Button>
              </div>
            )}

            {(activeJob.status === 'out_for_delivery' || activeJob.status === 'in_transit') && (
              <form ref={pinForm} onSubmit={handleConfirmDelivery} className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-3 scroll-mt-20">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
                  <KeyRound className="w-4 h-4" />
                  Customer handover PIN
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ask the customer for the 4-digit PIN shown in their order tracking screen, then enter it to complete the delivery.
                </p>

                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={4}
                  placeholder={'\u2022 \u2022 \u2022 \u2022'}
                  aria-label="4-digit delivery PIN"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full min-w-0 h-16 px-4 bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 rounded-2xl font-mono text-center text-3xl font-black tracking-[0.5em] indent-[0.5em] text-white placeholder:text-slate-600 placeholder:tracking-[0.3em] focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                />

                {otpError && (
                  <p className="text-xs text-red-300 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {otpError}
                  </p>
                )}

                <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-30 -mx-4 px-4 pt-3 pb-1 bg-gradient-to-t from-slate-800 from-70% to-transparent rounded-b-2xl">
                <Button
                  type="submit"
                  disabled={verifyingOtp || otpInput.trim().length < 4}
                  className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-base rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {verifyingOtp ? <Spinner size="sm" /> : (<><CheckCircle className="w-5 h-5" /> Confirm delivery</>)}
                </Button>
                </div>
              </form>
            )}
          </div>
        </section>
      ) : (
        <>
          {jobError && (
            <p className="text-xs text-red-300 bg-red-950/50 border border-red-900/60 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {jobError}
            </p>
          )}
          {isOnline && openJobs.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                Available jobs
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">{openJobs.length}</span>
              </h3>
              {openJobs.map((job) => (
                <article key={job.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono text-slate-500">JOB #{job.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Trip earning</p>
                    </div>
                    <span className="text-2xl font-black text-amber-400 leading-none">{formatMoney(job.driverEarning || 0)}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{job.pickupAddress?.label || 'Pickup store'}</p>
                        <p className="text-xs text-slate-400 truncate">{[job.pickupAddress?.line1, job.pickupAddress?.city].filter(Boolean).join(', ')}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{job.deliveryAddress?.city}, {job.deliveryAddress?.state}</p>
                        <p className="text-xs text-slate-400">Drop-off area</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleAcceptJob(job)}
                    disabled={acceptingId === job.id}
                    className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-base rounded-xl"
                  >
                    {acceptingId === job.id ? <Spinner size="sm" /> : 'Accept job'}
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 px-6 py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
                <Truck className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">No jobs right now</h3>
              <p className="text-xs text-slate-400 max-w-[16rem] mx-auto leading-relaxed">
                {isOnline ? 'Stay online. New delivery jobs appear here the moment a customer orders.' : 'Go online to see and accept available delivery jobs.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
