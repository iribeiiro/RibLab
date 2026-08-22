import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Quote, Customer, QuoteStatus } from '../types';
import { X, Printer, FileText, Check, AlertCircle, HelpCircle, Calendar, Wrench, Package } from 'lucide-react';
import { motion } from 'motion/react';

interface PrintQuoteProps {
  quote: Quote;
  onClose: () => void;
}

export default function PrintQuote({ quote, onClose }: PrintQuoteProps) {
  const [format, setFormat] = useState<'a4' | 'thermal'>('a4');
  const [customerDetails, setCustomerDetails] = useState<Customer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch {
      setIsIframe(true);
    }
  }, []);

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!quote.customerId) return;
      setLoadingCustomer(true);
      try {
        const docRef = doc(db, 'customers', quote.customerId);
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
  }, [quote.customerId]);

  const handlePrint = () => {
    window.print();
  };

  const getStatusLabel = (status: QuoteStatus) => {
    switch (status) {
      case QuoteStatus.Pending: return 'Em Análise / Pendente';
      case QuoteStatus.Approved: return 'Aprovado pelo Cliente';
      case QuoteStatus.Rejected: return 'Recusado';
      case QuoteStatus.Converted: return 'Convertido em OS';
      default: return status;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return new Date().toLocaleDateString('pt-BR');
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return new Date(timestamp).toLocaleDateString('pt-BR');
  };

  const validityDate = () => {
    const days = quote.validityDays || 10;
    const baseDate = quote.createdAt?.toDate ? quote.createdAt.toDate() : new Date();
    const expDate = new Date(baseDate);
    expDate.setDate(expDate.getDate() + days);
    return expDate.toLocaleDateString('pt-BR');
  };

  return (
    <>
      {/* 1. Modal Preview on Screen */}
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[70] flex items-center justify-center p-2 sm:p-4 print:hidden overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto"
        >
          {/* Header Controls */}
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 tracking-tight text-lg sm:text-xl flex items-center gap-2">
                  <span>Imprimir / Gerar PDF do Orçamento</span>
                  <span className="text-xs bg-blue-100 text-blue-800 font-mono px-2 py-0.5 rounded-full">
                    #{quote.quoteNumber}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">Pré-visualização da proposta comercial para o cliente</p>
              </div>
            </div>

            {/* Actions and Format Switcher */}
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFormat('a4')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    format === 'a4' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Folha A4
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('thermal')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    format === 'thermal' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cupom Térmico
                </button>
              </div>

              <button
                type="button"
                onClick={handlePrint}
                className="tech-gradient text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <Printer size={16} />
                <span>Imprimir / Salvar PDF</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body Preview */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/70 flex justify-center">
            <div className="w-full max-w-2xl space-y-4">
              
              {/* If running inside iframe banner */}
              {isIframe && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-left">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                    <AlertCircle size={14} /> Dica de Impressão (Preview)
                  </span>
                  <p className="text-[11px] text-amber-700 leading-relaxed font-sans">
                    Se você estiver usando no painel de preview integrado, para imprimir ou salvar em PDF use o botão <strong>"Abrir em nova aba"</strong> no topo direito da tela.
                  </p>
                </div>
              )}

              {/* Format-based Screen Preview Card */}
              {format === 'a4' ? (
                /* A4 Document Visual Sheet */
                <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-lg border border-slate-200/80 text-left font-sans text-slate-800 space-y-6">
                  
                  {/* Header */}
                  <div className="flex justify-between items-start border-b border-slate-200 pb-5">
                    <div>
                      <h1 className="text-2xl font-black tracking-tight text-slate-900">RibLab</h1>
                      <p className="text-xs font-semibold text-slate-700">Gestão e Soluções Avançadas de TI</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">ribeiroigor722@gmail.com</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">PROPOSTA DE ORÇAMENTO</span>
                      <h2 className="text-xl font-extrabold text-blue-600 mt-0.5 font-mono">#{quote.quoteNumber}</h2>
                      <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full inline-block mt-1">
                        Status: {getStatusLabel(quote.status)}
                      </span>
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div className="space-y-1">
                    <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 pb-1">DADOS DO CLIENTE</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 text-slate-700">
                      <p><strong className="text-slate-900">Cliente:</strong> {quote.customerName}</p>
                      <p><strong className="text-slate-900">Telefone / WhatsApp:</strong> {quote.customerPhone}</p>
                      {(quote.customerEmail || customerDetails?.email) && (
                        <p><strong className="text-slate-900">E-mail:</strong> {quote.customerEmail || customerDetails?.email}</p>
                      )}
                      {(quote.customerAddress || customerDetails?.street) && (
                        <p className="col-span-2">
                          <strong className="text-slate-900">Endereço:</strong> {quote.customerAddress || `${customerDetails?.street || ''}, ${customerDetails?.number || 'S/N'} ${customerDetails?.neighborhood || ''}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Machine / Device Information */}
                  <div className="space-y-1 pt-1">
                    <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 pb-1">EQUIPAMENTO ANALISADO</h3>
                    <div className="grid grid-cols-4 gap-2 text-xs pt-1 text-slate-700">
                      <p><strong className="text-slate-900">Tipo:</strong> {quote.deviceType}</p>
                      <p><strong className="text-slate-900">Marca:</strong> {quote.deviceBrand || '-'}</p>
                      <p><strong className="text-slate-900">Modelo:</strong> {quote.deviceModel || '-'}</p>
                      <p><strong className="text-slate-900">Nº de Série:</strong> {quote.serialNumber || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Problem & Diagnostic */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase">DEFEITO RELATADO PELO CLIENTE</h4>
                      <p className="text-xs text-slate-700 leading-relaxed">{quote.reportedProblem || 'Não informado.'}</p>
                    </div>
                    <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/80 space-y-1">
                      <h4 className="text-[10px] font-bold text-blue-700 uppercase">LAUDO TÉCNICO / DIAGNÓSTICO DOS TESTES</h4>
                      <p className="text-xs text-slate-700 leading-relaxed">{quote.technicalDiagnosis || 'Em análise técnica preliminar.'}</p>
                    </div>
                  </div>

                  {/* Itemized Table of Services and Products */}
                  <div className="space-y-2 pt-1">
                    <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 pb-1">DISCRIMINAÇÃO DE SERVIÇOS E PRODUTOS</h3>
                    <table className="w-full border-collapse border border-slate-200 text-xs text-left">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="p-2 w-16">Tipo</th>
                          <th className="p-2">Descrição do Item / Produto / Serviço</th>
                          <th className="p-2 text-center w-16">Qtd</th>
                          <th className="p-2 text-right w-24">Unitário</th>
                          <th className="p-2 text-right w-28">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {quote.items && quote.items.length > 0 ? (
                          quote.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-2">
                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                  item.type === 'service' 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {item.type === 'service' ? 'Serviço' : 'Produto'}
                                </span>
                              </td>
                              <td className="p-2 font-medium text-slate-800">{item.description}</td>
                              <td className="p-2 text-center text-slate-600">{item.quantity}</td>
                              <td className="p-2 text-right text-slate-600">R$ {Number(item.unitPrice || 0).toFixed(2)}</td>
                              <td className="p-2 text-right font-bold text-slate-900">R$ {Number(item.totalPrice || (item.quantity * item.unitPrice) || 0).toFixed(2)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-3 text-center text-slate-400 italic">Nenhum item discriminado</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Photos Preview if present */}
                  {quote.devicePhotos && quote.devicePhotos.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 pb-1">
                        FOTOS DO EQUIPAMENTO ({quote.devicePhotos.length})
                      </h3>
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {quote.devicePhotos.map((photo, idx) => (
                          <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-slate-200">
                            <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financial Total Summary */}
                  <div className="pt-2">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Total de Mão de Obra / Serviços:</span>
                        <span className="font-semibold text-slate-800">R$ {(quote.servicesCost || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Total de Peças e Produtos:</span>
                        <span className="font-semibold text-slate-800">R$ {(quote.partsCost || 0).toFixed(2)}</span>
                      </div>
                      {(quote.discount || 0) > 0 && (
                        <div className="flex justify-between text-xs text-emerald-600">
                          <span>Desconto Aplicado:</span>
                          <span className="font-semibold">- R$ {(quote.discount || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-extrabold text-slate-900">
                        <span>VALOR TOTAL DO ORÇAMENTO:</span>
                        <span className="text-lg text-blue-600">R$ {(quote.totalAmount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes & Validity */}
                  <div className="text-xs text-slate-600 bg-amber-50/60 border border-amber-100 p-3 rounded-xl space-y-1">
                    <p><strong>Validade da Proposta:</strong> Válido por {quote.validityDays || 10} dias (até {validityDate()}).</p>
                    <p><strong>Garantia:</strong> Garantia legal de 90 dias para peças e serviços conforme o CDC após a conclusão.</p>
                    {quote.notes && <p><strong>Observações:</strong> {quote.notes}</p>}
                  </div>

                  {/* Signatures */}
                  <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                    <div>
                      <div className="border-b border-slate-300 w-44 mx-auto mb-1" />
                      <p className="font-bold text-slate-800">RibLab Gestão</p>
                      <p className="text-[10px] text-slate-400">Técnico Responsável</p>
                    </div>
                    <div>
                      <div className="border-b border-slate-300 w-44 mx-auto mb-1" />
                      <p className="font-bold text-slate-800">{quote.customerName}</p>
                      <p className="text-[10px] text-slate-400">Aprovação do Cliente</p>
                    </div>
                  </div>

                </div>
              ) : (
                /* Thermal Continuous Paper Preview */
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 max-w-[340px] mx-auto text-left font-mono text-[11px] text-slate-800 space-y-3 leading-snug">
                  <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-2">
                    <h2 className="text-sm font-black uppercase text-slate-900">RIBLAB TI</h2>
                    <p className="text-[9px]">Soluções e Manutenção de Informática</p>
                    <p className="text-[9px]">ribeiroigor722@gmail.com</p>
                    <p className="border-y border-dashed border-slate-300 py-1 my-1 font-bold text-xs uppercase text-blue-700">
                      ORÇAMENTO #{quote.quoteNumber}
                    </p>
                  </div>

                  <div className="text-[10px] space-y-0.5">
                    <p>Data: {formatDate(quote.createdAt)}</p>
                    <p>Status: {getStatusLabel(quote.status)}</p>
                    <p>Validade: {validityDate()} ({quote.validityDays || 10} dias)</p>
                  </div>

                  <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5">
                    <p className="font-bold">CLIENTE:</p>
                    <p>{quote.customerName}</p>
                    <p>Tel: {quote.customerPhone}</p>
                  </div>

                  <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5">
                    <p className="font-bold">EQUIPAMENTO:</p>
                    <p>{quote.deviceType} {quote.deviceBrand} {quote.deviceModel}</p>
                    {quote.serialNumber && <p>N/S: {quote.serialNumber}</p>}
                  </div>

                  <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5">
                    <p className="font-bold">DEFEITO RELATADO:</p>
                    <p className="text-[10px]">{quote.reportedProblem}</p>
                  </div>

                  {quote.technicalDiagnosis && (
                    <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5">
                      <p className="font-bold">LAUDO TÉCNICO:</p>
                      <p className="text-[10px]">{quote.technicalDiagnosis}</p>
                    </div>
                  )}

                  <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-1">
                    <p className="font-bold">ITENS / SERVIÇOS:</p>
                    {quote.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[10px]">
                        <span className="truncate pr-2">{item.quantity}x {item.description}</span>
                        <span className="font-bold shrink-0">R$ {Number(item.totalPrice || (item.quantity * item.unitPrice) || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Mão de Obra:</span>
                      <span>R$ {(quote.servicesCost || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Peças/Produtos:</span>
                      <span>R$ {(quote.partsCost || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xs border-t border-dashed border-slate-300 pt-1">
                      <span>TOTAL ORÇADO:</span>
                      <span>R$ {(quote.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-slate-300 pt-3 text-center text-[9px] space-y-3">
                    <p>Para aprovar, entre em contato ou assine abaixo:</p>
                    <div className="pt-4">
                      <div className="border-b border-slate-400 w-36 mx-auto" />
                      <p className="text-[8px] mt-0.5 uppercase">Aprovação do Cliente</p>
                    </div>
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
              #root {
                display: none !important;
              }
              body > div:not(.print-document-container) {
                display: none !important;
              }
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
              <div className="font-sans text-xs text-black p-10 space-y-5">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b border-black pb-4">
                  <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-black">RibLab</h1>
                    <p className="text-[11px] font-bold">Gestão e Soluções Avançadas de TI</p>
                    <p className="text-[10px] mt-0.5">ribeiroigor722@gmail.com</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider block">PROPOSTA DE ORÇAMENTO</span>
                    <h2 className="text-2xl font-bold mt-0.5">#{quote.quoteNumber}</h2>
                    <span className="text-[10px] font-medium border border-black px-2 py-0.5 inline-block uppercase mt-1">
                      Status: {getStatusLabel(quote.status)}
                    </span>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="space-y-1">
                  <h3 className="text-[11px] font-bold uppercase border-b border-black pb-0.5">DADOS DO CLIENTE</h3>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <p><strong>Nome Completo:</strong> {quote.customerName}</p>
                    <p><strong>Telefone / WhatsApp:</strong> {quote.customerPhone}</p>
                    {(quote.customerEmail || customerDetails?.email) && (
                      <p><strong>E-mail:</strong> {quote.customerEmail || customerDetails?.email}</p>
                    )}
                    {(quote.customerAddress || customerDetails?.street) && (
                      <p className="col-span-2">
                        <strong>Endereço:</strong> {quote.customerAddress || `${customerDetails?.street || ''}, ${customerDetails?.number || 'S/N'} ${customerDetails?.neighborhood || ''}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Equipment Details */}
                <div className="space-y-1 pt-1">
                  <h3 className="text-[11px] font-bold uppercase border-b border-black pb-0.5">ESPECIFICAÇÕES DO EQUIPAMENTO</h3>
                  <div className="grid grid-cols-4 gap-2 text-[11px] pt-1">
                    <p><strong>Tipo:</strong> {quote.deviceType}</p>
                    <p><strong>Marca:</strong> {quote.deviceBrand || '-'}</p>
                    <p><strong>Modelo:</strong> {quote.deviceModel || '-'}</p>
                    <p><strong>Nº de Série:</strong> {quote.serialNumber || 'N/A'}</p>
                  </div>
                </div>

                {/* Problem & Diagnostic */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="border border-black p-2.5 space-y-1 rounded-xs">
                    <h4 className="text-[10px] font-bold uppercase">DEFEITO RELATADO PELO CLIENTE</h4>
                    <p className="text-[10px] leading-snug">{quote.reportedProblem || 'Não informado.'}</p>
                  </div>
                  <div className="border border-black p-2.5 space-y-1 rounded-xs">
                    <h4 className="text-[10px] font-bold uppercase">LAUDO TÉCNICO / DIAGNÓSTICO DOS TESTES</h4>
                    <p className="text-[10px] leading-snug">{quote.technicalDiagnosis || 'Em análise técnica preliminar.'}</p>
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="space-y-1 pt-1">
                  <h3 className="text-[11px] font-bold uppercase border-b border-black pb-0.5">DISCRIMINAÇÃO DE SERVIÇOS E PRODUTOS</h3>
                  <table className="w-full border-collapse border border-black text-[10px] mt-1 text-left">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-black">
                        <th className="p-1.5 border-r border-black w-14">Tipo</th>
                        <th className="p-1.5 border-r border-black">Descrição</th>
                        <th className="p-1.5 border-r border-black text-center w-12">Qtd</th>
                        <th className="p-1.5 border-r border-black text-right w-20">Unitário</th>
                        <th className="p-1.5 text-right w-24">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.items?.map((item, idx) => (
                        <tr key={idx} className="border-b border-black">
                          <td className="p-1.5 border-r border-black uppercase font-semibold">
                            {item.type === 'service' ? 'Serviço' : 'Produto'}
                          </td>
                          <td className="p-1.5 border-r border-black">{item.description}</td>
                          <td className="p-1.5 border-r border-black text-center">{item.quantity}</td>
                          <td className="p-1.5 border-r border-black text-right">R$ {Number(item.unitPrice || 0).toFixed(2)}</td>
                          <td className="p-1.5 text-right font-bold">R$ {Number(item.totalPrice || (item.quantity * item.unitPrice) || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Device Photos if available */}
                {quote.devicePhotos && quote.devicePhotos.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <h3 className="text-[11px] font-bold uppercase border-b border-black pb-0.5">
                      FOTOS DO EQUIPAMENTO ({quote.devicePhotos.length})
                    </h3>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {quote.devicePhotos.map((photo, idx) => (
                        <div key={idx} className="border border-black p-1 text-center">
                          <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-20 object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Finance and Conditions */}
                <div className="space-y-1 pt-2">
                  <h3 className="text-[11px] font-bold uppercase border-b border-black pb-0.5">VALORES E CONDIÇÕES</h3>
                  <table className="w-full border-collapse border border-black text-[11px] mt-1 text-left">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="p-1.5">Mão de Obra / Serviços Técnicos</td>
                        <td className="p-1.5 text-right">R$ {(quote.servicesCost || 0).toFixed(2)}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-1.5">Peças / Componentes / Produtos</td>
                        <td className="p-1.5 text-right">R$ {(quote.partsCost || 0).toFixed(2)}</td>
                      </tr>
                      <tr className="font-bold bg-slate-100">
                        <td className="p-2 text-xs">VALOR TOTAL DA PROPOSTA</td>
                        <td className="p-2 text-right text-sm">R$ {(quote.totalAmount || 0).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex justify-between items-center text-[10px] pt-2">
                    <span>Validade da Proposta: <strong>{quote.validityDays || 10} dias (até {validityDate()})</strong></span>
                    <span>Garantia: <strong>3 meses (Conforme art. 26, II, CDC)</strong></span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="pt-12 grid grid-cols-2 gap-8 text-center">
                  <div>
                    <div className="border-b border-black mx-auto w-52 h-4" />
                    <p className="text-[9px] font-bold uppercase mt-1">Assinatura do Técnico</p>
                    <p className="text-[8px] text-slate-500">RibLab Gestão</p>
                  </div>
                  <div>
                    <div className="border-b border-black mx-auto w-52 h-4" />
                    <p className="text-[9px] font-bold uppercase mt-1">Assinatura do Cliente</p>
                    <p className="text-[8px] text-slate-500">Aprovado pelo Cliente</p>
                  </div>
                </div>

                <div className="text-center pt-6 text-[8px] text-slate-500">
                  Gerado em {new Date().toLocaleString('pt-BR')} por RibLab System.
                </div>
              </div>
            ) : (
              /* Real continuous thermal cupom */
              <div className="font-mono text-black p-4 w-[74mm] text-[10px] space-y-2.5 leading-snug mx-auto">
                <div className="text-center space-y-1">
                  <h2 className="text-md font-bold uppercase">RIBLAB TI</h2>
                  <p className="text-[8px]">Soluções e Reparos Rápidos</p>
                  <p className="text-[8px]">ribeiroigor722@gmail.com</p>
                  <p className="border-y border-dashed border-black py-1 my-1 uppercase font-bold text-[10px]">
                    ORÇAMENTO #{quote.quoteNumber}
                  </p>
                </div>

                <div className="text-[9px]">
                  <p>Emissão: {formatDate(quote.createdAt)}</p>
                  <p>Validade: {validityDate()}</p>
                  <p>Status: {getStatusLabel(quote.status)}</p>
                </div>

                <div className="border-t border-dashed border-black pt-1">
                  <p className="font-bold">CLIENTE:</p>
                  <p>{quote.customerName}</p>
                  <p>Tel: {quote.customerPhone}</p>
                </div>

                <div className="border-t border-dashed border-black pt-1">
                  <p className="font-bold">EQUIPAMENTO:</p>
                  <p>{quote.deviceType} {quote.deviceBrand}</p>
                  <p>Modelo: {quote.deviceModel}</p>
                  {quote.serialNumber && <p>N/S: {quote.serialNumber}</p>}
                </div>

                <div className="border-t border-dashed border-black pt-1">
                  <p className="font-bold">DEFEITO RELATADO:</p>
                  <p className="text-[9px] leading-normal">{quote.reportedProblem}</p>
                  {quote.technicalDiagnosis && (
                    <>
                      <p className="font-bold mt-1">LAUDO TÉCNICO:</p>
                      <p className="text-[9px] leading-normal">{quote.technicalDiagnosis}</p>
                    </>
                  )}
                </div>

                <div className="border-t border-dashed border-black pt-1 space-y-0.5">
                  <p className="font-bold">ITENS:</p>
                  {quote.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-[9px]">
                      <span>{item.quantity}x {item.description}</span>
                      <span>R$ {Number(item.totalPrice || (item.quantity * item.unitPrice) || 0).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold border-t border-dashed border-black mt-1 pt-1 text-[11px]">
                    <span>TOTAL ORÇAMENTO:</span>
                    <span>R$ {(quote.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-black pt-2 text-center text-[8px] space-y-3">
                  <p>Garantia de 3 meses conforme CDC.</p>
                  <div className="pt-3">
                    <div className="border-b border-black w-32 mx-auto" />
                    <p className="text-[7px] mt-0.5 uppercase">Aprovação do Cliente</p>
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
