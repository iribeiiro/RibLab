import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ServiceOrder, Customer, OrderStatus } from '../types';
import { X, Printer, FileText, Check, AlertCircle, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface PrintOrderProps {
  order: ServiceOrder;
  onClose: () => void;
}

export default function PrintOrder({ order, onClose }: PrintOrderProps) {
  const [format, setFormat] = useState<'a4' | 'thermal'>('a4');
  const [customerDetails, setCustomerDetails] = useState<Customer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
    }
  }, []);

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!order.customerId) return;
      setLoadingCustomer(true);
      try {
        const docRef = doc(db, 'customers', order.customerId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCustomerDetails({ id: docSnap.id, ...docSnap.data() } as Customer);
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes adicionais do cliente", error);
      } finally {
        setLoadingCustomer(false);
      }
    };
    fetchCustomer();
  }, [order.customerId]);

  const handlePrint = () => {
    // Standard call to print
    window.print();
  };

  const getStatusLabel = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.Pending: return 'Pendente';
      case OrderStatus.InProgress: return 'Em Serviço';
      case OrderStatus.WaitingParts: return 'Aguardando Peças';
      case OrderStatus.Completed: return 'Concluído / Pronto';
      case OrderStatus.Canceled: return 'Cancelado';
      default: return status;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '...';
    if (timestamp.toDate) return timestamp.toDate().toLocaleString('pt-BR');
    if (timestamp instanceof Date) return timestamp.toLocaleString('pt-BR');
    return String(timestamp);
  };

  return (
    <>
      {/* 1. Modal overlay (Interactive Preview Panel - Hidden on Print) */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 print:hidden overflow-y-auto">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-[2rem] border border-slate-200 w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
        >
          {/* Modal Sidebar with Options */}
          <div className="w-full md:w-80 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-6 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 tracking-tight text-lg">Imprimir / PDF</h3>
                  <p className="text-xs text-slate-500 font-medium font-sans">Opções de Ordem de Serviço</p>
                </div>
                <button 
                  onClick={onClose} 
                  className="md:hidden text-slate-400 hover:text-slate-900 p-1.5 bg-white rounded-full border border-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Format Switcher */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block font-mono">Modelo do Documento</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-200/50 p-1 rounded-xl">
                  <button
                    onClick={() => setFormat('a4')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-lg transition-all ${
                      format === 'a4' 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FileText size={14} />
                    A4 Padrão
                  </button>
                  <button
                    onClick={() => setFormat('thermal')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-lg transition-all ${
                      format === 'thermal' 
                        ? 'bg-white text-green-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Printer size={14} />
                    Cupom 80mm
                  </button>
                </div>
              </div>

              {/* Instructions and Hints */}
              {isIframe && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-left">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                    <AlertCircle size={14} /> Bloqueio de Impressão (Preview)
                  </span>
                  <p className="text-[11px] text-amber-700 leading-relaxed font-sans">
                    Navegadores bloqueiam o comando de impressão direta quando o aplicativo roda <strong className="text-amber-950">dentro deste painel de chat</strong>.
                  </p>
                  <p className="text-[11px] text-amber-700 leading-relaxed font-medium font-sans">
                    💡 <strong>Como Imprimir / PDF:</strong> Clique no botão <strong>"Abrir em nova aba"</strong> (o ícone de seta saindo do quadrado no canto superior direito do seu preview) para abrir em tela cheia. Lá você poderá gerar e salvar os comprovantes perfeitamente!
                  </p>
                </div>
              )}

              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-2.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                  <HelpCircle size={14} /> Dicas do Navegador:
                </span>
                <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc list-inside">
                  <li>Para baixar virtualmente, selecione a impressora <strong className="text-slate-900">Salvar como PDF</strong>.</li>
                  <li>Para cupons, configure as <strong className="text-slate-900">Margens para "Nenhuma"</strong> para um corte perfeito.</li>
                  <li>Ative <strong className="text-slate-900">Gráficos de plano de fundo</strong> para preservar cores e bordas.</li>
                </ul>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-6 border-t border-slate-200 space-y-3">
              <button
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-100 active:scale-95"
              >
                <Printer size={16} />
                IMPRIMIR / PDF
              </button>
              
              <button
                onClick={onClose}
                className="w-full text-center py-2.5 bg-slate-200/50 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
              >
                FECHAR PREVISÃO
              </button>
            </div>
          </div>

          {/* On-Screen Document Live Preview (Interactive styling mimicking printout) */}
          <div className="flex-1 bg-slate-100 p-6 md:p-10 overflow-y-auto flex justify-center">
            <div className="w-full max-w-[21cm] bg-white shadow-md rounded-2xl overflow-hidden p-8 text-black min-h-[29.7cm] relative text-left">
              {format === 'a4' ? (
                /* A4 Preview Model */
                <div className="space-y-8 font-sans text-xs text-slate-700">
                  {/* Visual Divider Strip */}
                  <div className="h-2 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-t-lg -mt-8 -mx-8 mb-6" />
                  
                  {/* Business info & Document title */}
                  <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                    <div>
                      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        RibLab
                      </h1>
                      <p className="text-[11px] text-slate-500 font-medium">Gestão e Soluções Avançadas de TI</p>
                      <p className="text-[10px] text-slate-400 mt-1">ribeiroigor722@gmail.com</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">ORDEM DE SERVIÇO</span>
                      <h2 className="text-xl font-bold text-slate-900 mt-0.5">#{order.orderNumber}</h2>
                      <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-green-100 text-green-800">
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                  </div>

                  {/* Customer Information Section */}
                  <div className="space-y-3">
                    <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 pb-1">DADOS DO CLIENTE</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-mono">Nome Completo</p>
                        <p className="font-bold text-slate-900 text-sm">{order.customerName}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-mono">Telefone / WhatsApp</p>
                        <p className="font-bold text-slate-900 text-sm">{order.customerPhone}</p>
                      </div>
                      {customerDetails && (
                        <div className="col-span-2 grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg">
                          {customerDetails.email && (
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-mono">E-mail</p>
                              <p className="font-medium text-slate-700">{customerDetails.email}</p>
                            </div>
                          )}
                          {(customerDetails.street || customerDetails.neighborhood) && (
                            <div className="col-span-2">
                              <p className="text-[9px] text-slate-400 uppercase font-mono">Endereço</p>
                              <p className="font-medium text-slate-700">
                                {customerDetails.street || ''}, {customerDetails.number || 'S/N'} {customerDetails.complement ? `- ${customerDetails.complement}` : ''}
                                <br />
                                {customerDetails.neighborhood ? `${customerDetails.neighborhood}` : ''} {customerDetails.city ? `- ${customerDetails.city}` : ''} / {customerDetails.state || ''}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Equipment Details */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 pb-1">ESPECIFICAÇÕES DO EQUIPAMENTO</h3>
                    <div className="grid grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl">
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-mono">Tipo</p>
                        <p className="font-bold text-slate-950">{order.deviceType}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-mono">Marca</p>
                        <p className="font-bold text-slate-950">{order.deviceBrand || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-mono">Modelo</p>
                        <p className="font-bold text-slate-950">{order.deviceModel || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-mono">Nº de Série</p>
                        <p className="font-bold text-slate-950 font-mono text-[11px]">{order.serialNumber || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Diagnósticos and Internal Report */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                      <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Defeito Relatado / Sintoma</h4>
                      <div className="border border-slate-100 p-4 rounded-xl min-h-24 bg-white text-slate-700 leading-relaxed font-sans text-[11px]">
                        {order.problemDescription}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Relatório Técnico / Solução</h4>
                      <div className="border border-slate-100 p-4 rounded-xl min-h-24 bg-white text-slate-700 leading-relaxed font-sans text-[11px]">
                        {order.technicalReport || <span className="italic text-slate-400">Nenhum relatório preenchido ainda.</span>}
                      </div>
                    </div>
                  </div>

                  {/* Device Photos in Preview */}
                  {order.devicePhotos && order.devicePhotos.length > 0 && (
                    <div className="space-y-2 pt-3">
                      <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 pb-1">
                        REGISTRO FOTOGRÁFICO DO EQUIPAMENTO ({order.devicePhotos.length})
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                        {order.devicePhotos.map((photo, idx) => (
                          <div key={idx} className="relative aspect-video bg-slate-200 rounded-lg overflow-hidden border border-slate-200 shadow-2xs">
                            <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                            <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[8px] font-mono px-1 rounded">
                              #{idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financial calculations */}
                  <div className="space-y-3 pt-4">
                    <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 pb-1">VALORES E PAGAMENTO</h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left font-sans text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] tracking-wider border-b border-slate-100">
                            <th className="px-4 py-3">Descrição do Serviço / Custo</th>
                            <th className="px-4 py-3 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          <tr>
                            <td className="px-4 py-3 font-medium">Mão de Obra / Serviço Técnico</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-950">R$ {(order.serviceCost || 0).toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-medium">Peças Utilizadas / Componentes</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-950">R$ {(order.partsCost || 0).toFixed(2)}</td>
                          </tr>
                          <tr className="bg-slate-50/50 font-bold text-slate-950 text-sm">
                            <td className="px-4 py-4">Total Geral</td>
                            <td className="px-4 py-4 text-right text-blue-600 font-extrabold text-base">R$ {(order.totalCost || 0).toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg text-[10px] font-mono uppercase text-slate-500">
                      <span>Forma de Pagamento: <strong>{order.paymentMethod || 'Dinheiro/Pix'}</strong></span>
                      <span>Garantia: <strong>3 meses (Somente para o serviço relatado)</strong></span>
                    </div>
                  </div>

                  {/* Signature Section */}
                  <div className="pt-10 grid grid-cols-2 gap-10">
                    <div className="flex flex-col items-center">
                      <div className="w-56 border-b border-slate-400 h-10" />
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mt-2">Assinatura do Técnico</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">RibLab Soluções</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-56 border-b border-slate-400 h-10" />
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mt-2">Assinatura do Cliente</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Declaro que recebi o equipamento testado e em perfeito estado.</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Thermal 80mm Preview Model */
                <div className="max-w-[80mm] mx-auto font-mono text-[11px] text-slate-800 space-y-4">
                  <div className="text-center space-y-1">
                    <h2 className="text-lg font-bold tracking-tight text-slate-950">RIBLAB TI</h2>
                    <p className="text-[9px]">Sistemas e Manutenções</p>
                    <p className="text-[9px]">ribeiroigor722@gmail.com</p>
                    <p className="text-[10px] font-bold border-y border-dashed border-slate-350 py-1.5 my-2">ORDEM DE SERVIÇO #{order.orderNumber}</p>
                  </div>

                  <div className="space-y-1">
                    <p><strong>Emissão:</strong> {formatDate(order.createdAt)}</p>
                    <p><strong>Status:</strong> {getStatusLabel(order.status)}</p>
                  </div>

                  <div className="border-t border-dashed border-slate-250 pt-2 space-y-1">
                    <p className="font-bold text-[10px] text-slate-900 uppercase">CLIENTE:</p>
                    <p className="truncate">Nome: {order.customerName}</p>
                    <p>Tel: {order.customerPhone}</p>
                  </div>

                  <div className="border-t border-dashed border-slate-250 pt-2 space-y-1">
                    <p className="font-bold text-[10px] text-slate-900 uppercase">EQUIPAMENTO:</p>
                    <p>{order.deviceType} {order.deviceBrand}</p>
                    <p>Mod: {order.deviceModel}</p>
                    <p>S/N: {order.serialNumber || 'N/A'}</p>
                  </div>

                  <div className="border-t border-dashed border-slate-250 pt-2 space-y-1">
                    <p className="font-bold text-[10px] text-slate-900 uppercase">DETALHES:</p>
                    <p className="whitespace-pre-line text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded">{order.problemDescription}</p>
                    {order.technicalReport && (
                      <>
                        <p className="mt-1"><strong>Laudo:</strong></p>
                        <p className="whitespace-pre-line text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded">{order.technicalReport}</p>
                      </>
                    )}
                  </div>

                  {order.devicePhotos && order.devicePhotos.length > 0 && (
                    <div className="border-t border-dashed border-slate-250 pt-2 space-y-1">
                      <p className="font-bold text-[10px] text-slate-900 uppercase">FOTOS DO EQUIPAMENTO ({order.devicePhotos.length}):</p>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {order.devicePhotos.map((photo, idx) => (
                          <img key={idx} src={photo} alt={`Foto ${idx + 1}`} className="w-full h-16 object-cover rounded border border-slate-200" />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-dashed border-slate-250 pt-2 space-y-1 text-right">
                    <div className="flex justify-between">
                      <span>Mão de obra:</span>
                      <strong>R$ {(order.serviceCost || 0).toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Peças:</span>
                      <strong>R$ {(order.partsCost || 0).toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between border-t border-dashed border-slate-200 mt-1 pt-1 font-bold text-xs">
                      <span>TOTAL GERAL:</span>
                      <span>R$ {(order.totalCost || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-slate-250 pt-3 space-y-4 text-center">
                    <p className="text-[9px]">Garantia: 3 meses para Serviços.</p>
                    <div className="pt-6">
                      <div className="border-b border-slate-400 mx-auto w-40" />
                      <p className="text-[8px] mt-1 uppercase font-bold text-slate-500">Assinatura do Cliente</p>
                    </div>
                    <p className="text-[10px] font-bold py-1.5">Obrigado pela preferência!</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* 2. Hidden Real Print Section (Rendered inside React Portal attached directly to document.body) */}
      {createPortal(
        <>
          <style>{`
            @media print {
              /* Hide standard web layout completely to prevent bleeding through */
              #root {
                display: none !important;
              }
              /* Hide other overlays / modals that are not our printable wrapper */
              body > div:not(.print-document-container) {
                display: none !important;
              }
              /* Assure our target printable section fills the paper nicely */
              body .print-document-container {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                min-height: 100vh !important;
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
                z-index: 99999999 !important;
              }
            }
          `}</style>
          <div className="hidden print:block absolute inset-0 w-full min-h-screen bg-white text-black p-0 m-0 text-left print-document-container">
            {format === 'a4' ? (
              /* Real A4 printable page */
              <div className="font-sans text-xs text-black p-10 space-y-6">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b border-black pb-5">
                  <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-black">RibLab</h1>
                    <p className="text-[11px] font-bold">Gestão e Soluções Avançadas de TI</p>
                    <p className="text-[10px] mt-0.5">ribeiroigor722@gmail.com</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider block">ORDEM DE SERVIÇO</span>
                    <h2 className="text-2xl font-bold mt-1">#{order.orderNumber}</h2>
                    <span className="text-[10px] font-medium border border-black px-2 py-0.5 inline-block uppercase mt-1">
                      Status: {getStatusLabel(order.status)}
                    </span>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="space-y-1">
                  <h3 className="text-[11px] font-bold uppercase border-b border-black pb-0.5">DADOS DO CLIENTE</h3>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 pt-b">
                    <p><strong>Nome Completo:</strong> {order.customerName}</p>
                    <p><strong>Telefone / WhatsApp:</strong> {order.customerPhone}</p>
                    {customerDetails && (
                      <>
                        {customerDetails.email && <p><strong>E-mail:</strong> {customerDetails.email}</p>}
                        {(customerDetails.street || customerDetails.neighborhood) && (
                          <p className="col-span-2">
                            <strong>Endereço:</strong> {customerDetails.street || ''}, {customerDetails.number || 'S/N'} {customerDetails.complement ? `- ${customerDetails.complement}` : ''}, {customerDetails.neighborhood || ''}, {customerDetails.city || ''}/{customerDetails.state || ''}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Equipment Details */}
                <div className="space-y-1 pt-1">
                  <h3 className="text-[11px] font-bold uppercase border-b border-black pb-0.5">ESPECIFICAÇÕES DO EQUIPAMENTO</h3>
                  <div className="grid grid-cols-4 gap-2 text-[11px] pt-1">
                    <p><strong>Tipo:</strong> {order.deviceType}</p>
                    <p><strong>Marca:</strong> {order.deviceBrand || '-'}</p>
                    <p><strong>Modelo:</strong> {order.deviceModel || '-'}</p>
                    <p><strong>Nº de Série:</strong> {order.serialNumber || 'N/A'}</p>
                  </div>
                </div>

                {/* Problem & Diagnostic */}
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="border border-black p-3 space-y-1 rounded-sm">
                    <h4 className="text-[10px] font-bold uppercase">DEFEITO RELATADO / SINTOMA</h4>
                    <p className="text-[10px] leading-snug">{order.problemDescription}</p>
                  </div>
                  <div className="border border-black p-3 space-y-1 rounded-sm">
                    <h4 className="text-[10px] font-bold uppercase font-mono">RELATÓRIO TÉCNICO / SOLUÇÃO</h4>
                    <p className="text-[10px] leading-snug">{order.technicalReport || 'Nenhum laudo técnico inserido.'}</p>
                  </div>
                </div>

                {/* Device Photos on A4 Printable */}
                {order.devicePhotos && order.devicePhotos.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <h3 className="text-[11px] font-bold uppercase border-b border-black pb-0.5">
                      REGISTRO FOTOGRÁFICO DO EQUIPAMENTO / ESTADO FÍSICO ({order.devicePhotos.length})
                    </h3>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {order.devicePhotos.map((photo, idx) => (
                        <div key={idx} className="border border-black p-1 rounded-xs text-center bg-white">
                          <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-24 object-cover" />
                          <span className="text-[8px] font-mono block mt-0.5">Foto #{idx + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Finance and payments */}
                <div className="space-y-1 pt-2">
                  <h3 className="text-[11px] font-bold uppercase border-b border-black pb-0.5">VALORES E CONDIÇÕES</h3>
                  <table className="w-full border-collapse border border-black text-[11px] mt-1 text-left">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="p-2">Mão de obra / Serviço Técnico</td>
                        <td className="p-2 text-right">R$ {(order.serviceCost || 0).toFixed(2)}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-2">Peças Utilizadas / Componentes</td>
                        <td className="p-2 text-right">R$ {(order.partsCost || 0).toFixed(2)}</td>
                      </tr>
                      <tr className="font-bold bg-slate-100">
                        <td className="p-2">Total Geral</td>
                        <td className="p-2 text-right text-base">R$ {(order.totalCost || 0).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex justify-between items-center text-[10px] pt-2">
                    <span>Forma de Pagamento: <strong>{order.paymentMethod || 'Dinheiro/Pix'}</strong></span>
                    <span>Garantia: <strong>3 meses (Conforme art. 26, II, CDC)</strong></span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="pt-16 grid grid-cols-2 gap-10 text-center">
                  <div>
                    <div className="border-b border-black mx-auto w-56 h-4" />
                    <p className="text-[9px] font-bold uppercase mt-1">Assinatura do Técnico</p>
                    <p className="text-[8px] text-slate-500">RibLab Gestão</p>
                  </div>
                  <div>
                    <div className="border-b border-black mx-auto w-56 h-4" />
                    <p className="text-[9px] font-bold uppercase mt-1">Assinatura do Cliente</p>
                    <p className="text-[8px] text-slate-500">Equipamento retirado em termos satisfatórios</p>
                  </div>
                </div>

                <div className="text-center pt-10 text-[9px] text-slate-500">
                  Gerado em {new Date().toLocaleString('pt-BR')} por RibLab System.
                </div>
              </div>
            ) : (
              /* Real continuous thermal cupom */
              <div className="font-mono text-black p-4 w-[74mm] text-[10px] space-y-3 leading-snug mx-auto">
                <div className="text-center space-y-1">
                  <h2 className="text-md font-bold uppercase">RIBLAB TI</h2>
                  <p className="text-[8px]">Soluções e Reparos Rápidos</p>
                  <p className="text-[8px]">ribeiroigor722@gmail.com</p>
                  <p className="border-y border-dashed border-black py-1 my-1 uppercase font-bold text-[10px]">ORDEM DE SERVIÇO #{order.orderNumber}</p>
                </div>

                <div className="text-[9px]">
                  <p>Emissão: {formatDate(order.createdAt)}</p>
                  <p>Status: {getStatusLabel(order.status)}</p>
                </div>

                <div className="border-t border-dashed border-black pt-1">
                  <p className="font-bold">CLIENTE:</p>
                  <p>{order.customerName}</p>
                  <p>Tel: {order.customerPhone}</p>
                  {customerDetails?.street && (
                    <p className="text-[8px]">{customerDetails.street}, {customerDetails.number || 'S/N'}, {customerDetails.neighborhood || ''}</p>
                  )}
                </div>

                <div className="border-t border-dashed border-black pt-1">
                  <p className="font-bold">EQUIPAMENTO:</p>
                  <p>{order.deviceType} {order.deviceBrand}</p>
                  <p>Modelo: {order.deviceModel}</p>
                  <p>N/S: {order.serialNumber || 'N/A'}</p>
                </div>

                <div className="border-t border-dashed border-black pt-1">
                  <p className="font-bold">RECLAMAÇÃO:</p>
                  <p className="text-[9px] leading-normal">{order.problemDescription}</p>
                  {order.technicalReport && (
                    <>
                      <p className="font-bold mt-1">SOLUÇÃO:</p>
                      <p className="text-[9px] leading-normal">{order.technicalReport}</p>
                    </>
                  )}
                </div>

                {order.devicePhotos && order.devicePhotos.length > 0 && (
                  <div className="border-t border-dashed border-black pt-1">
                    <p className="font-bold text-[9px] uppercase">FOTOS DO EQUIPAMENTO ({order.devicePhotos.length}):</p>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      {order.devicePhotos.map((photo, idx) => (
                        <img key={idx} src={photo} alt={`Foto ${idx + 1}`} className="w-full h-20 object-cover border border-black" />
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-dashed border-black pt-1 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Serviços:</span>
                    <span>R$ {(order.serviceCost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between flex-row">
                    <span>Peças:</span>
                    <span>R$ {(order.partsCost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-dashed border-black mt-1 pt-1 text-[11px]">
                    <span>TOTAL GERAL:</span>
                    <span>R$ {(order.totalCost || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-black pt-2 text-center text-[8px] space-y-4">
                  <p>Garantia de 3 meses para Serviços.</p>
                  <div className="pt-4">
                    <div className="border-b border-black w-36 mx-auto" />
                    <p className="text-[7px] mt-0.5 uppercase">Cliente</p>
                  </div>
                  <p className="text-[9px] font-bold">Obrigado pela preferência!</p>
                </div>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
