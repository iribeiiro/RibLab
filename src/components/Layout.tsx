import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle, logout } from '../lib/firebase';
import { LogIn, LogOut, Monitor, Settings, Plus, LayoutDashboard, Search, FileText, Package, Users, ClipboardList, FlaskConical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function Layout({ children, activeView, onViewChange }: LayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <motion.div 
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-slate-400 font-medium tracking-tight flex items-center gap-2"
        >
          <FlaskConical size={20} className="text-blue-500 animate-pulse" />
          <span>Carregando RibLab...</span>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-100/50 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-100/50 rounded-full blur-3xl" />
        
        <div className="bg-white/80 backdrop-blur-xl p-12 rounded-[2.5rem] shadow-2xl shadow-blue-100 border border-white flex flex-col items-center max-w-md w-full z-10 relative">
          <div className="w-20 h-20 tech-gradient rounded-2xl flex items-center justify-center text-white mb-8 group transition-transform hover:scale-105 active:scale-95 relative">
            <div className="absolute inset-0 bg-white/20 rounded-2xl animate-ping group-hover:block hidden" />
            <div className="relative">
              <Monitor size={38} className="drop-shadow-md" />
              <FlaskConical 
                size={22} 
                className="absolute -bottom-1 -right-2 text-cyan-200 fill-cyan-400/20 drop-shadow-sm rotate-12" 
              />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-600">RibLab</h1>
          <p className="text-slate-500 mb-10 text-center font-medium font-sans">Sua infraestrutura em boas mãos. <br /><span className="text-xs opacity-70">Sistemas Avançados de Gestão</span></p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 tech-gradient text-white px-8 py-4 rounded-2xl font-bold font-sans transition-all active:scale-95 group shadow-lg shadow-blue-200"
          >
            <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
            Entrar no Sistema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex h-screen sticky top-0 shadow-sm z-20">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10 group cursor-pointer" onClick={() => onViewChange('dashboard')}>
            <div className="w-10 h-10 tech-gradient rounded-xl flex items-center justify-center text-white shadow-md relative">
              <Monitor size={20} />
              <FlaskConical size={12} className="absolute -bottom-0.5 -right-0.5 text-cyan-200 rotate-12" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">RibLab</h1>
          </div>
          
          <nav className="space-y-1">
            <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeView === 'dashboard'} onClick={() => onViewChange('dashboard')} />
            <SidebarItem icon={<ClipboardList size={20} />} label="Ordens de Serviço" active={activeView === 'orders'} onClick={() => onViewChange('orders')} />
            <SidebarItem icon={<Package size={20} />} label="Estoque" active={activeView === 'inventory'} onClick={() => onViewChange('inventory')} />
            <SidebarItem icon={<Users size={20} />} label="Clientes" active={activeView === 'customers'} onClick={() => onViewChange('customers')} />
          </nav>
        </div>
        
        <div className="mt-auto p-6 border-t border-slate-50 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
              {user.photoURL ? <img src={user.photoURL} alt="" /> : <div className="text-slate-400 font-bold">{user.email?.charAt(0).toUpperCase()}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-slate-800">{user.displayName || 'Técnico'}</p>
              <p className="text-[10px] text-slate-500 truncate uppercase font-bold tracking-wider">{user.email}</p>
            </div>
            <button 
              onClick={logout}
              className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center z-50 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 tech-gradient rounded-lg flex items-center justify-center text-white relative">
              <Monitor size={14} />
              <FlaskConical size={8} className="absolute -bottom-0.5 -right-0.5 text-cyan-200 rotate-12" />
            </div>
            <span className="font-bold tracking-tight text-slate-900">RibLab</span>
          </div>
          <button onClick={logout} className="text-slate-400 p-2"><LogOut size={18} /></button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 bg-[#F8FAFC] pb-28 lg:pb-10">
          {children}
        </main>

        {/* Mobile Navigation Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-3 flex justify-around items-center z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <MobileNavItem icon={<LayoutDashboard size={22} />} label="Início" active={activeView === 'dashboard'} onClick={() => onViewChange('dashboard')} />
          <MobileNavItem icon={<ClipboardList size={22} />} label="OS" active={activeView === 'orders'} onClick={() => onViewChange('orders')} />
          <MobileNavItem icon={<Package size={22} />} label="Estoque" active={activeView === 'inventory'} onClick={() => onViewChange('inventory')} />
          <MobileNavItem icon={<Users size={22} />} label="Clientes" active={activeView === 'customers'} onClick={() => onViewChange('customers')} />
        </nav>
      </div>
    </div>
  );
}

function MobileNavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all ${active ? 'text-blue-600' : 'text-slate-400'}`}
    >
      <div className={`${active ? 'scale-110' : ''} transition-transform`}>{icon}</div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      {active && <motion.div layoutId="mobileNav" className="w-1 h-1 bg-blue-600 rounded-full mt-0.5" />}
    </button>
  );
}

function SidebarItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`
      flex items-center gap-3 px-4 py-3 w-full rounded-xl transition-all font-medium
      ${active 
        ? 'bg-blue-50 text-blue-600' 
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}
    `}>
      <span className={active ? 'text-blue-600' : 'opacity-70'}>{icon}</span>
      <span className="text-sm tracking-tight">{label}</span>
    </button>
  );
}
