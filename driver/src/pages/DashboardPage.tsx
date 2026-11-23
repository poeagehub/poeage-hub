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
import { Link } from 'react-router-dom';
import { ActionButton, Notice, StatTile, RadarEmpty } from '../components/ui';
import {
  MapPin,
  Navigation,
  CheckCircle,
  Phone,
  ShieldCheck,
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
  Star,
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

  // ----- derived numbers for the summary tiles -----
  const toMs = (t: any): number => (t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : t instanceof Date ? t.getTime() : 0);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const doneMs = (d: Delivery) => toMs(d.deliveredAt) || toMs(d.updatedAt);
  const tripsToday = completedTrips.filter((d) => doneMs(d) >= dayStart.getTime());
  const earnedToday = tripsToday.reduce((s, d) => s + (d.driverEarning || 0), 0);
  const recentTrips = [...completedTrips].sort((a, b) => doneMs(b) - doneMs(a)).slice(0, 4);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = (driver?.displayName || '').trim().split(/\s+/)[0] || 'Partner';
  const timeOf = (d: Delivery) => {
    const ms = doneMs(d);
    return ms ? new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  };

  // Pinned action area: floats above the phone tab bar, sits inline on desktop.
  const Sticky: React.FC<{ children: React.ReactNode; from?: string }> = ({ children, from = 'from-[#0d1424]' }) => (
    <div className={`sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-30 -mx-5 px-5 pt-5 pb-1 bg-gradient-to-t ${from} from-60% to-transparent lg:static lg:mx-0 lg:px-0 lg:pt-1 lg:pb-0 lg:bg-none`}>
      {children}
    </div>
  );

  const routeBlock = (kind: 'pickup' | 'drop') => {
    const isPickup = kind === 'pickup';
    const a = isPickup ? activeJob?.pickupAddress : activeJob?.deliveryAddress;
    const link = mapsLink(a as any);
    return (
      <div className="relative pl-9 min-[380px]:pl-10">
        <span className={`absolute left-0 top-1 w-7 h-7 rounded-full flex items-center justify-center ${isPickup ? 'bg-accent-500 text-white' : 'bg-emerald-400 text-slate-950'}`}>
          {isPickup ? <Store className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
        </span>
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 min-[380px]:p-4">
          <p className={`text-[10px] font-extrabold uppercase tracking-[0.14em] ${isPickup ? 'text-accent-300' : 'text-emerald-300'}`}>{isPickup ? 'Pickup · Seller' : 'Drop-off · Customer'}</p>
          <p className="text-[15px] font-extrabold text-white mt-1 leading-snug">
            {isPickup ? (activeJob?.pickupAddress?.label || 'Pickup store') : (activeJob?.deliveryAddress?.recipientName || 'Customer')}
          </p>
          <p className="text-[13px] text-slate-400 mt-1 leading-relaxed">
            {isPickup
              ? [a?.line1, a?.city, a?.state].filter(Boolean).join(', ')
              : [a?.line1, (a as any)?.landmark ? `Landmark: ${(a as any).landmark}` : '', [a?.city, a?.state].filter(Boolean).join(', ') + ((a as any)?.pincode ? ` – ${(a as any).pincode}` : '')].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {link && (
              <a href={link} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-xs font-extrabold border transition active:scale-95 ${isPickup ? 'bg-accent-400/10 text-accent-200 border-accent-400/30 hover:bg-accent-400/20' : 'bg-white/5 text-slate-100 border-white/15 hover:bg-white/10'}`}>
                <Navigation className="w-3.5 h-3.5" /> Navigate
              </a>
            )}
            {!isPickup && (a as any)?.phone && (
              <a href={`tel:${(a as any).phone}`} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-xs font-extrabold border bg-emerald-400/10 text-emerald-200 border-emerald-400/30 hover:bg-emerald-400/20 transition active:scale-95">
                <Phone className="w-3.5 h-3.5" /> Call customer
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="px-3 min-[380px]:px-4 sm:px-6 lg:px-10 pt-4 lg:pt-10 max-w-[1280px] mx-auto space-y-4 lg:space-y-7">
      {/* Greeting (desktop; phones greet in the top bar) */}
      <div className="hidden lg:flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-3xl font-black tracking-tight text-white mt-1">{greeting}, {first}</h1>
        </div>
        <ActionButton tone="outline" size="sm" onClick={fetchDeliveries} aria-label="Refresh jobs">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </ActionButton>
      </div>

      {/* Availability banner */}
      {!isOnline ? (
        <div className="relative overflow-hidden rounded-3xl border border-accent-400/25 bg-gradient-to-br from-accent-400/15 via-accent-400/5 to-transparent p-4 min-[380px]:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <span className="w-12 h-12 rounded-2xl bg-accent-400/15 text-accent-300 flex items-center justify-center shrink-0 max-[299px]:hidden"><Truck className="w-6 h-6" /></span>
            <div className="min-w-0">
              <p className="font-extrabold text-white leading-tight">You're offline</p>
              <p className="text-sm text-slate-400 mt-0.5">Go online to see and accept delivery jobs near you.</p>
            </div>
          </div>
          <ActionButton onClick={toggleAvailability} className="sm:w-auto w-full">Go online</ActionButton>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <p className="text-sm font-bold text-emerald-200 truncate">Online · ready for jobs</p>
          </div>
          <button onClick={fetchDeliveries} aria-label="Refresh jobs" className="lg:hidden inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold text-emerald-200 bg-emerald-400/10 active:bg-emerald-400/20">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      )}

      {/* Phone: earnings hero */}
      <section className="lg:hidden relative overflow-hidden rounded-[1.75rem] border border-accent-400/25 bg-gradient-to-br from-accent-500/30 via-accent-600/10 to-transparent p-4 min-[380px]:p-5">
        <div className="absolute -top-12 -right-8 w-40 h-40 rounded-full bg-accent-400/25 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent-200">Earned today</p>
            <p className="mt-1.5 text-[clamp(2rem,11vw,2.75rem)] leading-none font-black tracking-tight text-white tabular-nums truncate">{formatMoney(earnedToday)}</p>
            <p className="mt-2 text-xs text-slate-300">{tripsToday.length} {tripsToday.length === 1 ? 'trip' : 'trips'} completed today</p>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 max-[299px]:grid-cols-1 divide-x max-[299px]:divide-x-0 max-[299px]:divide-y divide-white/10 rounded-2xl bg-black/25 border border-white/10 text-center">
          {[
            { l: 'Total', v: formatMoney(todayEarningsPaise) },
            { l: 'Deliveries', v: String((driver?.metadata?.totalDeliveries || 0) + completedTrips.length) },
            { l: 'Rating', v: (driver?.metadata?.totalRatings ?? 0) > 0 ? String(driver?.metadata?.averageRating?.toFixed(1)) : '–' },
          ].map((c) => (
            <div key={c.l} className="min-w-0 px-1.5 py-2.5">
              <p className="text-[13px] min-[380px]:text-sm font-black text-white tabular-nums truncate">{c.v}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">{c.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Desktop: stat tiles */}
      <div className="hidden lg:grid grid-cols-4 gap-4">
        <StatTile icon={<Wallet className="w-4 h-4" />} label="Earned today" value={formatMoney(earnedToday)} sub={`${tripsToday.length} ${tripsToday.length === 1 ? 'trip' : 'trips'} today`} tone="amber" />
        <StatTile icon={<TrendingUp className="w-4 h-4" />} label="Total earned" value={formatMoney(todayEarningsPaise)} sub="All completed trips" tone="green" />
        <StatTile icon={<PackageCheck className="w-4 h-4" />} label="Deliveries" value={(driver?.metadata?.totalDeliveries || 0) + completedTrips.length} sub="Verified partner" tone="sky" />
        <StatTile icon={<Star className="w-4 h-4" />} label="Rating" value={(driver?.metadata?.totalRatings ?? 0) > 0 ? driver?.metadata?.averageRating?.toFixed(1) : '–'} sub={(driver?.metadata?.totalRatings ?? 0) > 0 ? `${driver?.metadata?.totalRatings} ratings` : 'No ratings yet'} tone="violet" />
      </div>

      {successNotice && <Notice tone="success" className="animate-[slideUp_.25s_ease-out]"><span className="font-bold">{successNotice}</span></Notice>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-5 lg:gap-7 items-start">
        <div className="space-y-5 min-w-0">
          {activeJob ? (
            <section className="d-card-solid shadow-2xl shadow-black/40">
              {/* header */}
              <div className="rounded-t-3xl px-4 min-[380px]:px-5 pt-5 pb-5 bg-gradient-to-br from-accent-400/[0.12] via-white/[0.02] to-transparent border-b border-white/[0.06] space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-mono font-bold text-slate-400">JOB #{activeJob.id.slice(0, 8).toUpperCase()}</span>
                  <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-sky-400/15 text-sky-200 border border-sky-400/30 capitalize whitespace-nowrap">
                    {activeJob.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-400">You earn for this trip</p>
                    <p className="text-[clamp(2rem,11vw,2.5rem)] font-black text-accent-300 leading-none mt-1.5 tabular-nums">{formatMoney(activeJob.driverEarning || 0)}</p>
                  </div>
                </div>

                <ol className="flex items-start" aria-label="Delivery progress">
                  {STEPS.map((label, i) => {
                    const n = i + 1;
                    const cur = stepOf(activeJob.status);
                    const done = cur > n;
                    const now = cur === n;
                    return (
                      <li key={label} className="flex-1 flex flex-col items-center relative">
                        {i > 0 && <span className={`absolute top-3 right-1/2 w-full h-0.5 ${cur >= n ? 'bg-accent-400' : 'bg-white/10'}`} />}
                        <span className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${done ? 'bg-accent-500 text-white' : now ? 'bg-accent-500 text-white ring-4 ring-accent-400/25' : 'bg-[#0d1424] text-slate-500 border border-white/15'}`}>
                          {done ? '✓' : n}
                        </span>
                        <span className={`mt-2 text-[10.5px] font-bold text-center leading-tight ${cur >= n ? 'text-slate-100' : 'text-slate-500'}`}>{label}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* body */}
              <div className="p-4 min-[380px]:p-5 space-y-5">
                <div className="relative space-y-3">
                  <span className="absolute left-[13px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-accent-400/60 to-emerald-400/60 rounded-full" />
                  {routeBlock('pickup')}
                  {routeBlock('drop')}
                </div>

                {jobError && <Notice tone="error">{jobError}</Notice>}

                {['assigned', 'driver_accepted', 'driver_at_vendor'].includes(activeJob.status) && (
                  <div className="space-y-3">
                    <Notice tone={parcelReady ? 'success' : 'warn'}>
                      {parcelReady ? 'The parcel is packed and ready for collection.' : 'Waiting for the seller to finish packing. You can collect it once it is marked ready.'}
                    </Notice>
                    <Sticky>
                      <ActionButton tone="blue" size="lg" className="w-full" onClick={() => handleUpdateStatus('picked_up')} disabled={!parcelReady}>
                        <Truck className="w-5 h-5" /> Picked up from store
                      </ActionButton>
                    </Sticky>
                  </div>
                )}

                {activeJob.status === 'picked_up' && (
                  <Sticky>
                    <ActionButton tone="violet" size="lg" className="w-full" onClick={() => handleUpdateStatus('out_for_delivery')}>
                      <Navigation className="w-5 h-5" /> Start delivery
                    </ActionButton>
                  </Sticky>
                )}

                {(activeJob.status === 'out_for_delivery' || activeJob.status === 'in_transit') && (
                  <form ref={pinForm} onSubmit={handleConfirmDelivery} className="rounded-2xl border border-accent-400/25 bg-accent-400/[0.06] p-5 space-y-4 scroll-mt-24">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-accent-300"><KeyRound className="w-4 h-4" /> Customer handover PIN</div>
                    <p className="text-[13px] text-slate-400 leading-relaxed">Ask the customer for the 4-digit PIN on their order tracking screen, then enter it to complete the delivery.</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      maxLength={4}
                      placeholder={'• • • •'}
                      aria-label="4-digit delivery PIN"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full min-w-0 h-[4.5rem] px-4 bg-black/40 border-2 border-white/15 focus:border-accent-300 rounded-2xl font-mono text-center text-4xl font-black tracking-[0.5em] indent-[0.5em] text-white placeholder:text-slate-600 placeholder:tracking-[0.3em] focus:outline-none focus:ring-4 focus:ring-accent-400/20"
                    />
                    {otpError && <Notice tone="error">{otpError}</Notice>}
                    <Sticky from="from-[#1b1e24]">
                      <ActionButton type="submit" tone="green" size="lg" className="w-full" loading={verifyingOtp} disabled={otpInput.trim().length < 4}>
                        <CheckCircle className="w-5 h-5" /> Confirm delivery
                      </ActionButton>
                    </Sticky>
                  </form>
                )}
              </div>
            </section>
          ) : (
            <>
              {jobError && <Notice tone="error">{jobError}</Notice>}
              {isOnline && openJobs.length > 0 ? (
                <div className="space-y-4">
                  <h2 className="flex items-center gap-2.5 text-sm font-extrabold text-white">
                    Available jobs
                    <span className="px-2.5 py-0.5 rounded-full bg-accent-500 text-white text-[11px] font-black">{openJobs.length}</span>
                  </h2>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {openJobs.map((job) => (
                      <article key={job.id} className="d-card-solid p-4 min-[380px]:p-5 flex flex-col gap-5 hover:border-accent-400/30 transition">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-mono text-slate-500">JOB #{job.id.slice(0, 8).toUpperCase()}</p>
                            <p className="text-xs text-slate-400 mt-1">Trip earning</p>
                          </div>
                          <span className="px-3.5 py-1.5 rounded-xl bg-accent-400/10 border border-accent-400/25 text-2xl font-black text-accent-300 leading-none tabular-nums">{formatMoney(job.driverEarning || 0)}</span>
                        </div>
                        <div className="relative space-y-4 pl-6">
                          <span className="absolute left-[5px] top-3 bottom-3 w-0.5 border-l-2 border-dashed border-white/15" />
                          <div className="relative">
                            <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-accent-400 ring-4 ring-accent-400/20" />
                            <p className="text-sm font-bold text-white truncate">{job.pickupAddress?.label || 'Pickup store'}</p>
                            <p className="text-xs text-slate-400 truncate">{[job.pickupAddress?.line1, job.pickupAddress?.city].filter(Boolean).join(', ')}</p>
                          </div>
                          <div className="relative">
                            <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" />
                            <p className="text-sm font-bold text-white truncate">{job.deliveryAddress?.city}, {job.deliveryAddress?.state}</p>
                            <p className="text-xs text-slate-400">Drop-off area</p>
                          </div>
                        </div>
                        <ActionButton tone="green" size="lg" className="w-full mt-auto" onClick={() => handleAcceptJob(job)} loading={acceptingId === job.id}>
                          Accept job <ArrowRight className="w-4 h-4" />
                        </ActionButton>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <RadarEmpty
                  active={isOnline}
                  title={isOnline ? 'Looking for jobs…' : 'You’re offline'}
                  text={isOnline ? 'Stay online. New delivery jobs appear here the moment a customer places an order.' : 'Go online to see and accept available delivery jobs.'}
                />
              )}
            </>
          )}
        </div>

        {/* Side column */}
        <aside className="space-y-5 lg:sticky lg:top-8">
          <section className="d-card p-4 min-[380px]:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2"><Clock className="w-4 h-4 text-accent-300" /> Recent trips</h2>
              <Link to="/history" className="text-xs font-bold text-accent-300 hover:text-accent-200">View all</Link>
            </div>
            {recentTrips.length === 0 ? (
              <p className="text-sm text-slate-500 mt-4 leading-relaxed">Completed deliveries will appear here.</p>
            ) : (
              <ul className="mt-4 space-y-1">
                {recentTrips.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5 border-b border-white/[0.06] last:border-0">
                    <span className="w-9 h-9 rounded-xl bg-emerald-400/10 text-emerald-300 flex items-center justify-center shrink-0"><CheckCircle className="w-4 h-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{t.deliveryAddress?.recipientName || 'Customer'}</p>
                      <p className="text-[11px] text-slate-500 truncate">{timeOf(t)}</p>
                    </div>
                    <span className="text-sm font-black text-accent-300 tabular-nums">+{formatMoney(t.driverEarning || 0)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="d-card p-5">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-300" /> Delivery checklist</h2>
            <ul className="mt-3 space-y-2.5 text-[13px] text-slate-400">
              {['Collect the parcel only after the seller marks it ready', 'Ask the customer for the 4-digit PIN at the door', 'Never share or accept the PIN over chat'].map((t) => (
                <li key={t} className="flex items-start gap-2.5"><CheckCircle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />{t}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
};
