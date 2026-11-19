import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Truck, RotateCcw, Headphones } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

export const Footer: React.FC = () => {
  const { settings } = useSettings();
  return (
    <footer className="bg-slate-900 text-gray-300 mt-12 md:mt-20 border-t border-slate-800 pb-20 md:pb-0">
      {/* Trust Highlights */}
      <div className="border-b border-slate-800 py-5 md:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Express Shipping</p>
              <p className="text-xs text-gray-400">All India delivery</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-600/20 text-green-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Secure Payments</p>
              <p className="text-xs text-gray-400">256-bit encryption</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Easy Returns</p>
              <p className="text-xs text-gray-400">7-day replacement guarantee</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">24/7 Support</p>
              <p className="text-xs text-gray-400">Dedicated help desk</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">P</div>
            <span className="font-extrabold text-white text-base">POEAGE HUB</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed mb-4">
            India's unified multi-vendor commerce and fast fulfillment ecosystem.
          </p>
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} POEAGE HUB. All rights reserved.</p>
        </div>

        <div className="hidden md:block">
          <h4 className="font-semibold text-white text-sm mb-3">Shop Categories</h4>
          <ul className="space-y-2 text-xs text-gray-400">
            <li><Link to="/category/electronics" className="hover:text-white transition-colors">Electronics</Link></li>
            <li><Link to="/category/fashion" className="hover:text-white transition-colors">Fashion</Link></li>
            <li><Link to="/category/home-kitchen" className="hover:text-white transition-colors">Home & Kitchen</Link></li>
            <li><Link to="/category/beauty" className="hover:text-white transition-colors">Beauty & Personal Care</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white text-sm mb-3">Customer Care</h4>
          <ul className="space-y-2 text-xs text-gray-400">
            <li><Link to="/account/orders" className="hover:text-white transition-colors">Track Orders</Link></li>
            <li><Link to="/shipping-policy" className="hover:text-white transition-colors">Shipping Policy</Link></li>
            <li><Link to="/returns" className="hover:text-white transition-colors">Returns & Refunds</Link></li>
            <li><Link to="/support" className="hover:text-white transition-colors">Help & Contact</Link></li>
            {settings.supportEmail && <li>{settings.supportEmail}</li>}
            {settings.supportPhone && <li>{settings.supportPhone}</li>}
            {settings.supportHours && <li className="text-gray-500">{settings.supportHours}</li>}
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white text-sm mb-3">Partner With Us</h4>
          <ul className="space-y-2 text-xs text-gray-400">
            <li><a href="http://localhost:5175" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">Sell on POEAGE (Vendor)</a></li>
            <li><a href="http://localhost:5176" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">Drive with Us (Driver)</a></li>
            <li><a href="http://localhost:5174" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-300">Admin Control Center</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
};
