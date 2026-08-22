import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ServiceOrder, OrderStatus, Sale } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Clock, CheckCircle, AlertCircle, BarChart3, TrendingUp, Check, Trash2, AlertTriangle, Loader2, X } from 'lucide-react';
import OrderDetail from './OrderDetail';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

export default function Dashboard() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<ServiceOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const qOrders = query(
      collection(db, 'serviceOrders'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ServiceOrder[];
      setOrders(ordersData);
    }, (error) => {
      console.error("Error listening to serviceOrders:", error);
      handleFirestoreError(error, OperationType.LIST, 'serviceOrders');
    });

    const qSales = query(
      collection(db, 'sales'),
      orderBy('soldAt', 'desc'),
      limit(100)
    );

    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      const salesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sale[];
      setSales(salesData);
    }, (error) => {
      console.error("Error listening to sales:", error);
      handleFirestoreError(error, OperationType.LIST, 'sales');
    });

    return () => {
      unsubscribeOrders();
      unsubscribeSales();
    };
  }, []);

  const handleQuickComplete = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    if (loadingId) return;
    setLoadingId(orderId);
    try {
      await updateDoc(doc(db, 'serviceOrders', orderId), {
        status: OrderStatus.Completed,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error completing order:", error);
      handleFirestoreError(error, OperationType.UPDATE, `serviceOrders/${orderId}`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete?.id) return;
    const targetId = orderToDelete.id;
    setIsDeleting(true);
    try {
      if (selectedOrder?.id === targetId) {
        setSelectedOrder(null);
      }
      setOrderToDelete(null);
      await deleteDoc(doc(db, 'serviceOrders', targetId));
    } catch (error) {
      console.error("Error deleting order:", error);
      handleFirestoreError(error, OperationType.DELETE, `serviceOrders/${targetId}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusLabel = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.Pending: return 'Pendente';
      case OrderStatus.InProgress: return 'Em Serviço';
      case OrderStatus.WaitingParts: return 'Aguardando Peças';
      case OrderStatus.Completed: return 'Concluído';
      case OrderStatus.Canceled: return 'Cancelado';
      default: return status || 'Pendente';
    }
  };

  useEffect(() => {
    // Process data for charts safely
    const monthlyData: { [key: string]: { month: string, servicos: number, vendas: number, lucro: number } } = {};
    
    // Last 6 months labels
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthName = d.toLocaleString('pt-BR', { month: 'short' });
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      months.push({ key, name: monthName });
      monthlyData[key] = { month: monthName, servicos: 0, vendas: 0, lucro: 0 };
    }

    orders.forEach(order => {
      if (!order?.createdAt?.toDate) return;
      try {
        const d = order.createdAt.toDate();
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (monthlyData[key] && order.status === OrderStatus.Completed) {
          const sCost = Number(order.serviceCost) || 0;
          monthlyData[key].servicos += sCost;
          monthlyData[key].lucro += sCost;
        }
      } catch (e) {
        console.warn('Error reading order date for charts', e);
      }
    });

    sales.forEach(sale => {
      if (!sale?.soldAt?.toDate) return;
      try {
        const d = sale.soldAt.toDate();
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (monthlyData[key]) {
          const sPrice = Number(sale.salePrice) || 0;
          const sProfit = Number(sale.profit) || 0;
          monthlyData[key].vendas += sPrice;
          monthlyData[key].lucro += sProfit;
        }
      } catch (e) {
        console.warn('Error reading sale date for charts', e);
      }
    });

    setChartData(months.map(m => monthlyData[m.key]));
  }, [orders, sales]);

  const totalServiceProfit = orders
    .filter(o => o.status === OrderStatus.Completed)
    .reduce((acc, order) => acc + (Number(order.serviceCost) || 0), 0);
  
  const totalSalesProfit = sales.reduce((acc, sale) => acc + (Number(sale.profit) || 0), 0);
  const totalAccumulatedProfit = totalServiceProfit + totalSalesProfit;

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard icon={<ClipboardList size={20} />} label="Pendente" value={orders.filter(o => o.status === OrderStatus.Pending).length.toString()} color="text-slate-800" />
        <StatCard icon={<Clock size={20} />} label="Em Serviço" value={orders.filter(o => o.status === OrderStatus.InProgress).length.toString()} color="text-amber-500" />
        <StatCard icon={<CheckCircle size={20} />} label="Pronto" value={orders.filter(o => o.status === OrderStatus.Completed).length.toString()} color="text-green-600" />
        <StatCard icon={<TrendingUp size={20} />} label="Lucro" value={`R$ ${totalAccumulatedProfit.toFixed(2)}`} color="text-blue-600" />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-50 p-2 rounded-xl text-blue-600"><BarChart3 size={20} /></div>
            <div>
              <h3 className="font-bold text-slate-900 tracking-tight">Faturamento Mensal</h3>
              <p className="text-xs text-slate-500">Serviços vs Vendas de Produtos</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Legend iconType="circle" />
                <Bar name="Serviços" dataKey="servicos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar name="Vendas" dataKey="vendas" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-green-50 p-2 rounded-xl text-green-600"><TrendingUp size={20} /></div>
            <div>
              <h3 className="font-bold text-slate-900 tracking-tight">Evolução do Lucro</h3>
              <p className="text-xs text-slate-500">Lucro líquido total por mês</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  name="Lucro Líquido" 
                  type="monotone" 
                  dataKey="lucro" 
                  stroke="#16a34a" 
                  strokeWidth={4} 
                  dot={{ r: 4, fill: '#16a34a', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm shadow-slate-100">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 tracking-tight">Ordens Recentes</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F8FAFC] text-slate-500 text-[11px] font-bold uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Equipamento</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Pagamento</th>
                <th className="px-6 py-4 text-right">Total</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {orders.map((order) => (
                <tr 
                  key={order.id} 
                  onClick={() => setSelectedOrder(order)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    #{order.orderNumber}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{order.customerName}</div>
                    <div className="text-xs text-slate-500">{order.customerPhone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-700">{order.deviceType}</div>
                    <div className="text-xs text-slate-500">{order.deviceBrand} {order.deviceModel}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`
                      text-[10px] font-bold px-3 py-1 rounded-lg uppercase tracking-tight shadow-sm
                      ${order.status === OrderStatus.Completed ? 'bg-green-500/10 text-green-600 border border-green-200' : 
                        order.status === OrderStatus.Pending ? 'bg-blue-500/10 text-blue-600 border border-blue-200' :
                        order.status === OrderStatus.Canceled ? 'bg-red-500/10 text-red-600 border border-red-200' :
                        'bg-amber-500/10 text-amber-600 border border-amber-200'}
                    `}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded uppercase">{order.paymentMethod || '-'}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-900">
                    R$ {(Number(order.totalCost) || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {order.status !== OrderStatus.Completed && (
                        <button 
                          onClick={(e) => handleQuickComplete(e, order.id!)}
                          disabled={loadingId === order.id}
                          className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-sm shadow-green-200"
                          title="Concluir Ordem"
                        >
                          <Check size={15} strokeWidth={3} />
                        </button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrderToDelete(order);
                        }}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all hover:scale-105 active:scale-95"
                        title="Excluir Ordem de Serviço"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                    Nenhuma ordem de serviço registrada...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <OrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {orderToDelete && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[95] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
                  <AlertTriangle size={24} />
                </div>
                <button
                  type="button"
                  onClick={() => !isDeleting && setOrderToDelete(null)}
                  className="text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Excluir Ordem de Serviço?</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Tem certeza que deseja excluir permanentemente a OS <strong className="text-slate-800">#{orderToDelete.orderNumber}</strong> do cliente <strong className="text-slate-800">{orderToDelete.customerName}</strong> ({orderToDelete.deviceType} {orderToDelete.deviceBrand} {orderToDelete.deviceModel})?
                </p>
                <div className="mt-3 p-3 bg-red-50/50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
                  Esta ação é irreversível e removerá todos os dados e histórico desta ordem.
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOrderToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-100 active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Sim, Excluir
                    </>
                  )}
                </button>
              </div>
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
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:shadow-slate-100"
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <div className="flex items-center justify-between">
        <p className={`text-2xl font-bold tracking-tight ${color}`}>{value}</p>
        <div className={`opacity-20 ${color}`}>{icon}</div>
      </div>
    </motion.div>
  );
}
