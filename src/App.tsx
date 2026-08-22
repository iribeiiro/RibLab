import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import OrderForm from './components/OrderForm';
import Inventory from './components/Inventory';
import Customers from './components/Customers';
import Quotes from './components/Quotes';
import ErrorBoundary from './components/ErrorBoundary';
import { Plus } from 'lucide-react';

export default function App() {
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <>
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Dashboard General</h2>
                <p className="text-slate-500 font-medium text-sm sm:text-base">Visão geral do negócio e ordens recentes</p>
              </div>
              
              <button 
                onClick={() => setShowNewOrder(true)}
                className="hidden sm:flex items-center gap-2 tech-gradient text-white px-6 py-3.5 rounded-2xl font-bold transition-all active:scale-95 group shadow-lg shadow-blue-100"
              >
                <Plus size={22} className="transition-transform group-hover:rotate-90" />
                Nova Ordem
              </button>
            </header>
            <Dashboard />
          </>
        );
      case 'orders':
        return (
          <>
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Ordens de Serviço</h2>
                <p className="text-slate-500 font-medium text-sm sm:text-base">Lista completa de reparos</p>
              </div>
              <button 
                onClick={() => setShowNewOrder(true)}
                className="hidden sm:flex items-center gap-2 tech-gradient text-white px-6 py-3.5 rounded-2xl font-bold transition-all active:scale-95 group shadow-lg shadow-blue-100"
              >
                <Plus size={22} className="transition-transform group-hover:rotate-90" />
                Nova Ordem
              </button>
            </header>
            <Dashboard />
          </>
        );
      case 'quotes':
        return (
          <>
            <Quotes onNavigateToOrders={() => setCurrentView('orders')} />
          </>
        );
      case 'inventory':
        return (
          <>
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Estoque e Vendas</h2>
                <p className="text-slate-500 font-medium text-sm sm:text-base">Gestão de produtos e lucros</p>
              </div>
            </header>
            <Inventory />
          </>
        );
      case 'customers':
        return (
          <>
            <Customers />
          </>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeView={currentView} onViewChange={setCurrentView}>
      <ErrorBoundary>
        <div className="max-w-6xl mx-auto">
          {renderView()}
          
          {/* New Order Modal */}
          {showNewOrder && (
            <OrderForm onClose={() => setShowNewOrder(false)} />
          )}
        </div>
      </ErrorBoundary>

      {/* Floating Action Button (Mobile) */}
      <div className="lg:hidden fixed bottom-24 right-6 z-40">
        <button 
          onClick={() => setShowNewOrder(true)}
          className="tech-gradient text-white p-5 rounded-3xl shadow-2xl border-4 border-white active:scale-95 hover:scale-110 transition-transform"
        >
          <Plus size={28} />
        </button>
      </div>
    </Layout>
  );
}
