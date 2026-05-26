import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { InventoryItem, Sale } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Package, TrendingUp, ShoppingBag, Plus, Save, X, Trash2, DollarSign, ArrowUpRight } from 'lucide-react';

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock' | 'sales'>('stock');
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    quantity: 0,
    costPrice: 0,
    salePrice: 0
  });

  useEffect(() => {
    const qItems = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'inventory'));

    const qSales = query(collection(db, 'sales'), orderBy('soldAt', 'desc'));
    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sale[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sales'));

    return () => {
      unsubscribeItems();
      unsubscribeSales();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'inventory'), {
        ...formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowForm(false);
      setFormData({ name: '', description: '', quantity: 0, costPrice: 0, salePrice: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleSale = async (item: InventoryItem) => {
    if (item.quantity <= 0) return;
    
    if (!confirm(`Confirmar venda de 1 unidade de "${item.name}"?`)) return;

    try {
      // 1. Decerment Quantity
      await updateDoc(doc(db, 'inventory', item.id!), {
        quantity: item.quantity - 1,
        updatedAt: serverTimestamp()
      });

      // 2. Record Sale
      await addDoc(collection(db, 'sales'), {
        productName: item.name,
        quantity: 1,
        costPrice: item.costPrice,
        salePrice: item.salePrice,
        profit: item.salePrice - item.costPrice,
        soldAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inventory/sales');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este item do estoque?')) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'inventory');
    }
  };

  const totalProfit = sales.reduce((acc, sale) => acc + sale.profit, 0);
  const stockValue = items.reduce((acc, item) => acc + (item.costPrice * item.quantity), 0);

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 flex-1">
          <StatCard 
            icon={<Package size={20} />} 
            label="Valor em Estoque" 
            value={`R$ ${stockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
            color="text-blue-600" 
          />
          <StatCard 
            icon={<TrendingUp size={20} />} 
            label="Lucro Total (Vendas)" 
            value={`R$ ${totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
            color="text-green-600" 
          />
          <StatCard 
            icon={<ShoppingBag size={20} />} 
            label="Itens Vendidos" 
            value={sales.length.toString()} 
            color="text-amber-500" 
          />
        </div>
        
        <button 
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 tech-gradient shadow-lg shadow-blue-100 transition-all hover:scale-105 active:scale-95"
        >
          <Plus size={20} />
          Novo Produto
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('stock')}
          className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'stock' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
        >
          Estoque
        </button>
        <button 
          onClick={() => setActiveTab('sales')}
          className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'sales' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
        >
          Vendas
        </button>
      </div>

      {activeTab === 'stock' ? (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F8FAFC] text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-5">Produto</th>
                  <th className="px-8 py-5">Qtd</th>
                  <th className="px-8 py-5">Custo</th>
                  <th className="px-8 py-5">Venda</th>
                  <th className="px-8 py-5">Lucro Un.</th>
                  <th className="px-8 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      {item.description && <div className="text-xs text-slate-500">{item.description}</div>}
                    </td>
                    <td className="px-8 py-5">
                      <span className={`font-mono font-bold ${item.quantity <= 2 ? 'text-red-500' : 'text-slate-600'}`}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-slate-500 font-mono text-sm">R$ {item.costPrice.toFixed(2)}</td>
                    <td className="px-8 py-5 text-slate-900 font-bold font-mono text-sm">R$ {item.salePrice.toFixed(2)}</td>
                    <td className="px-8 py-5">
                      <span className="text-green-600 font-bold text-sm bg-green-50 px-2 py-1 rounded-lg">
                        + R$ {(item.salePrice - item.costPrice).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleSale(item)}
                          disabled={item.quantity <= 0}
                          title="Vender 1 unidade"
                          className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-30"
                        >
                          <ShoppingBag size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id!)}
                          className="text-slate-300 hover:text-red-500 p-2 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-medium opacity-60">
                      Nenhum item cadastrado no estoque...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
           <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F8FAFC] text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-5">Data</th>
                  <th className="px-8 py-5">Produto</th>
                  <th className="px-8 py-5">Qtd</th>
                  <th className="px-8 py-5">Venda</th>
                  <th className="px-8 py-5">Lucro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {sale.soldAt?.toDate().toLocaleString('pt-BR')}
                    </td>
                    <td className="px-8 py-5 font-bold text-slate-900">{sale.productName}</td>
                    <td className="px-8 py-5 text-slate-600 font-mono">{sale.quantity}</td>
                    <td className="px-8 py-5 font-bold text-slate-900 font-mono text-sm">R$ {sale.salePrice.toFixed(2)}</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-1.5 text-green-600 font-bold text-sm">
                        <ArrowUpRight size={14} />
                        R$ {sale.profit.toFixed(2)}
                      </div>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-medium opacity-60">
                      Nenhuma venda registrada ainda...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between tech-gradient text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Package size={20} />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight">Cadastro de Produto</h2>
                </div>
                <button onClick={() => setShowForm(false)} className="hover:rotate-90 transition-transform"><X /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 block">Nome do Produto</label>
                  <input 
                    required
                    type="text"
                    className="tech-input"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: SSD 480GB Kingston"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 block">Descrição (Opcional)</label>
                  <input 
                    type="text"
                    className="tech-input"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 block">Preço de Custo (R$)</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      className="tech-input"
                      value={formData.costPrice}
                      onChange={e => setFormData({...formData, costPrice: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 block">Preço de Venda (R$)</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      className="tech-input"
                      value={formData.salePrice}
                      onChange={e => setFormData({...formData, salePrice: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 block">Quantidade Inicial</label>
                  <input 
                    required
                    type="number"
                    className="tech-input"
                    value={formData.quantity}
                    onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-6 py-4 font-bold text-slate-400 font-mono text-xs">// CANCELAR</button>
                  <button 
                    disabled={loading}
                    type="submit" 
                    className="flex-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-bold tech-gradient flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    <Save size={18} />
                    {loading ? 'SALVANDO...' : 'CADASTRAR ITEM'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-5 rounded-full -mr-16 -mt-16 transition-opacity group-hover:opacity-10 ${color.replace('text', 'bg')}`} />
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">{label}</p>
      <div className="flex items-center justify-between relative z-10">
        <p className={`text-2xl font-black tracking-tighter ${color}`}>{value}</p>
        <div className={`p-2 rounded-xl bg-slate-50 transition-colors group-hover:bg-white ${color}`}>{icon}</div>
      </div>
    </motion.div>
  );
}
