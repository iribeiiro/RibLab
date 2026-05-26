import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Customer } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Search, Mail, Phone, MapPin, X, Save, Trash2, MessageCircle, Edit2 } from 'lucide-react';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const formatWhatsAppLink = (number: string | undefined) => {
    if (!number) return '#';
    const cleaned = number.replace(/\D/g, '');
    if (!cleaned) return '#';
    // Ensure it has a country code, if not assume Brazil (55)
    const finalNumber = cleaned.length <= 11 ? `55${cleaned}` : cleaned;
    return `https://wa.me/${finalNumber}`;
  };

  const [formData, setFormData] = useState<Omit<Customer, 'id'>>({
    name: '',
    phone: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customers'));

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'customers', editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'customers'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: auth.currentUser.uid
        });
      }
      handleCloseForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'customers');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    const { id, createdAt, updatedAt, createdBy, ...data } = customer;
    setFormData({
      name: data.name || '',
      phone: data.phone || ''
    });
    setEditingId(id || null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ 
      name: '', 
      phone: ''
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este cliente?')) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'customers');
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Clientes</h2>
          <p className="text-slate-500 font-medium text-sm sm:text-base">Base de dados de clientes cadastrados</p>
        </div>
        
        <button 
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 tech-gradient text-white px-6 py-4 rounded-2xl font-bold transition-all active:scale-95 group shadow-lg shadow-blue-100"
        >
          <UserPlus size={20} />
          <span>Novo Cliente</span>
        </button>
      </header>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por nome ou telefone..."
          className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 focus:ring-4 focus:ring-blue-50 focus:border-blue-300 outline-none transition-all shadow-sm"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredCustomers.map((customer) => (
          <motion.div 
            layout
            key={customer.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative"
          >
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button 
                onClick={() => handleEdit(customer)}
                className="text-slate-300 hover:text-blue-500 transition-colors md:opacity-0 group-hover:opacity-100"
              >
                <Edit2 size={18} />
              </button>
              <button 
                onClick={() => handleDelete(customer.id!)}
                className="text-slate-300 hover:text-red-500 transition-colors md:opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 font-bold text-lg">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{customer.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Phone size={12} /> {customer.phone}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mb-6">
              <a 
                href={`tel:${customer.phone.replace(/\D/g, '')}`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 text-xs font-bold transition-colors border border-slate-100"
              >
                <Phone size={14} /> LIGAR
              </a>
              <a 
                href={formatWhatsAppLink(customer.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 hover:bg-green-100 rounded-xl text-green-700 text-xs font-bold transition-colors border border-green-100"
              >
                <MessageCircle size={14} /> WHATSAPP
              </a>
            </div>

            <div className="space-y-3">
            </div>
          </motion.div>
        ))}

        {filteredCustomers.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-400 italic">
            Nenhum cliente encontrado...
          </div>
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between tech-gradient text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    {editingId ? <Edit2 size={24} /> : <UserPlus size={24} />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">
                      {editingId ? 'Editar Perfil' : 'Cadastrar Cliente'}
                    </h2>
                    <p className="text-xs opacity-70">
                      {editingId ? 'Atualize as informações do cliente' : 'Preencha os dados do novo cliente'}
                    </p>
                  </div>
                </div>
                <button onClick={handleCloseForm} className="hover:rotate-90 transition-transform p-1">
                  <X />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 block">Nome Completo</label>
                    <input 
                      required
                      type="text"
                      className="tech-input"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="Ex: João Silva"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 block">Telefone</label>
                    <input 
                      required
                      type="text"
                      className="tech-input"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div className="pt-6 flex gap-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={handleCloseForm} 
                    className="flex-1 px-6 py-4 font-bold text-slate-400 font-mono text-xs hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    // CANCELAR
                  </button>
                  <button 
                    disabled={loading}
                    type="submit" 
                    className="flex-2 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold tech-gradient flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg shadow-blue-100"
                  >
                    <Save size={18} />
                    {loading ? 'SALVANDO...' : editingId ? 'ATUALIZAR PERFIL' : 'CADASTRAR CLIENTE'}
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
