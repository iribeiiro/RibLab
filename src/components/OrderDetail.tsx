import React, { useState } from 'react';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ServiceOrder, OrderStatus, Priority, PaymentMethod } from '../types';
import { motion } from 'motion/react';
import { X, Save, FileText, Settings, Wrench, User } from 'lucide-react';

interface OrderDetailProps {
  order: ServiceOrder;
  onClose: () => void;
}

export default function OrderDetail({ order, onClose }: OrderDetailProps) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(order.technicalReport || '');
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(order.paymentMethod || PaymentMethod.Pix);
  const [partsCost, setPartsCost] = useState(order.partsCost);
  const [serviceCost, setServiceCost] = useState(order.serviceCost);

  const handleUpdate = async () => {
    if (!order.id) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'serviceOrders', order.id), {
        technicalReport: report,
        status: status,
        paymentMethod: paymentMethod,
        partsCost: Number(partsCost),
        serviceCost: Number(serviceCost),
        totalCost: Number(partsCost) + Number(serviceCost),
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `serviceOrders/${order.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl border border-slate-200 w-full max-w-4xl shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 md:p-8 flex justify-between items-center border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 text-slate-500 px-3 py-1 rounded-lg text-xs font-bold tracking-tight">#{order.orderNumber}</div>
            <h2 className="font-bold text-slate-900 tracking-tight text-lg">{order.customerName}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors p-2 bg-slate-50 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-12">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <InfoBlock icon={<User size={16} />} label="Cliente" value={order.customerName} subValue={order.customerPhone} />
            <InfoBlock icon={<Wrench size={16} />} label="Equipamento" value={`${order.deviceType} ${order.deviceBrand}`} subValue={order.deviceModel} />
            <InfoBlock icon={<Settings size={16} />} label="Prioridade" value={order.priority} subValue={`Entrada: ${order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : '...'}`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Left Col: Problem Description */}
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Reclamação do Cliente</label>
              <div className="bg-slate-50 p-6 rounded-2xl text-slate-700 leading-relaxed">
                {order.problemDescription}
              </div>
              
              <div className="pt-6 space-y-4">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Status Atual</label>
                <div className="flex flex-wrap gap-2">
                  {Object.values(OrderStatus).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`
                        px-4 py-2 text-[10px] font-bold rounded-xl transition-all border
                        ${status === s 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}
                      `}
                    >
                      {s === OrderStatus.Pending ? 'Pendente' : 
                       s === OrderStatus.InProgress ? 'Em Serviço' :
                       s === OrderStatus.WaitingParts ? 'Aguardando Peças' :
                       s === OrderStatus.Completed ? 'Concluído' :
                       s === OrderStatus.Canceled ? 'Cancelado' : s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col: Technical Report & Costs */}
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Relatório Técnico</label>
              <textarea 
                rows={5}
                className="input-field resize-none py-4"
                placeholder="Detalhes internos e solução aplicada..."
                value={report}
                onChange={e => setReport(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 tracking-tight">Forma de Pagamento</label>
                  <select 
                    className="input-field"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  >
                    {Object.values(PaymentMethod).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 tracking-tight">Garantia (Meses)</label>
                  <div className="input-field flex items-center bg-slate-50 opacity-50 cursor-not-allowed">
                    <span className="text-xs">3 Meses (Fix)</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 tracking-tight">Serviço (R$)</label>
                  <input 
                    type="number"
                    className="input-field font-bold"
                    value={serviceCost}
                    onChange={e => setServiceCost(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 tracking-tight">Peças (R$)</label>
                  <input 
                    type="number"
                    className="input-field font-bold"
                    value={partsCost}
                    onChange={e => setPartsCost(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 flex justify-between items-center border-t border-slate-100 bg-slate-50/50">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Valor Final</span>
            <span className="text-3xl font-bold text-slate-900 tracking-tight">R$ {(Number(partsCost) + Number(serviceCost)).toFixed(2)}</span>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-3 font-semibold text-slate-500 hover:bg-slate-200/50 transition-colors rounded-xl font-mono text-xs">// CANCELAR</button>
            <button 
              onClick={handleUpdate}
              disabled={loading}
              className="tech-gradient text-white px-8 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
              <Save size={18} />
              {loading ? 'SINCRONIZANDO...' : 'SALVAR ALTERAÇÕES'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InfoBlock({ icon, label, value, subValue }: { icon: React.ReactNode, label: string, value: string, subValue?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 tracking-widest uppercase">
        {icon} {label}
      </div>
      <div className="font-bold text-slate-900 tracking-tight">{value}</div>
      {subValue && <div className="text-xs text-slate-500 font-medium">{subValue}</div>}
    </div>
  );
}
