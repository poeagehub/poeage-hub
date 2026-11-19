import React, { useState, useEffect } from 'react';
import { useDriverAuth } from '../../context/AuthContext';
import { getDocuments, where } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Delivery } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import { Card, CardContent, Badge, Spinner } from '@poeage/ui';
import { CheckCircle2, MapPin, Calendar, Clock, DollarSign, Truck } from 'lucide-react';

export const DriverHistoryPage: React.FC = () => {
  const { driver, user } = useDriverAuth();
  const [history, setHistory] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const driverId = driver?.id || user?.uid;
        if (!driverId) return;
        const past = (
          await getDocuments<Delivery>(COLLECTION.DELIVERIES, [
            where('driverId', '==', driverId),
            where('status', '==', 'delivered'),
          ])
        )
          .sort((a, b) => {
            const timeA = (a.deliveredAt as any)?.seconds || 0;
            const timeB = (b.deliveredAt as any)?.seconds || 0;
            return timeB - timeA;
          });
        setHistory(past);
      } catch (err) {
        console.error('Could not fetch delivery history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [driver, user]);

  const when = (d: Delivery): string => {
    const t = (d.deliveredAt ?? d.updatedAt ?? d.createdAt) as unknown as { seconds?: number; toMillis?: () => number } | Date | undefined;
    const ms = !t ? 0 : t instanceof Date ? t.getTime() : t.toMillis ? t.toMillis() : (t.seconds ?? 0) * 1000;
    return ms
      ? new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
      : '';
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-xl mx-auto pb-24">
      <div>
        <h1 className="text-xl font-black text-white tracking-tight">Delivery History</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Log of all completed parcel trips verified with doorstep OTP codes.
        </p>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Spinner size="lg" />
        </div>
      ) : history.length === 0 ? (
        <Card className="text-white border-slate-800 bg-slate-900 p-8 text-center text-white">
          <Truck className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-300">No Completed Trips Yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Deliveries confirmed using the 4-digit customer handover PIN will be recorded here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {history.map((del) => (
            <Card key={del.id} className="text-white border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-800">
                <div className="min-w-0">
                  <span className="font-mono text-xs font-bold text-slate-300">#{del.id.slice(0, 8).toUpperCase()}</span>
                  {when(del) && <p className="text-[11px] text-slate-500 mt-0.5">{when(del)}</p>}
                </div>
                <span className="text-lg font-black text-amber-400 leading-none">
                  +{formatMoney(del.driverEarning || 0)}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                {del.pickupAddress?.label && (
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                    <p className="min-w-0 truncate">From {del.pickupAddress.label}</p>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="min-w-0">
                    {del.deliveryAddress?.recipientName} · {del.deliveryAddress?.city}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Delivered with OTP verification
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
