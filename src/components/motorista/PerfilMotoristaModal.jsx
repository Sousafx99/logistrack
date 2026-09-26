import { useState, useEffect } from 'react';
import { User, Phone, Save, X, CreditCard, Sparkles } from 'lucide-react';

const TIPOS_PIX = [
  'Celular / WhatsApp',
  'CPF',
  'E-mail',
  'Chave Aleatória',
  'CNPJ'
];

export function PerfilMotoristaModal({ isOpen, onClose, onSave, dadosIniciais }) {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [tipoPix, setTipoPix] = useState(TIPOS_PIX[0]);
  const [chavePix, setChavePix] = useState('');

  useEffect(() => {
    if (dadosIniciais) {
      setNome(dadosIniciais.nome || '');
      setWhatsapp(dadosIniciais.whatsapp || '');
      setChavePix(dadosIniciais.chavePix || dadosIniciais.chave_pix || dadosIniciais.pix || '');
      setTipoPix(dadosIniciais.tipoPix || dadosIniciais.tipoChavePix || TIPOS_PIX[0]);
    }
  }, [dadosIniciais, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome.trim() || !whatsapp.trim()) {
      alert('Por favor, preencha o Nome e o WhatsApp.');
      return;
    }
    onSave({ 
      nome: nome.trim(), 
      whatsapp: whatsapp.trim(),
      chavePix: chavePix.trim(),
      pix: chavePix.trim(),
      tipoPix
    });
  };

  // Aplica máscara de telefone simples
  const handleWhatsappChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 10) {
      value = `${value.slice(0, 10)}-${value.slice(10)}`;
    }
    setWhatsapp(value);
  };

  const handleCopiarWhatsappParaPix = () => {
    if (whatsapp) {
      setChavePix(whatsapp);
      setTipoPix('Celular / WhatsApp');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background-primary/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-background-secondary w-full max-w-sm rounded-2xl shadow-2xl border border-border-secondary p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center">
            <User className="mr-2 text-info" />
            Perfil do Motorista
          </h2>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 text-text-tertiary hover:text-text-primary bg-background-primary rounded-full transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <p className="text-xs text-text-secondary mb-5 leading-relaxed">
          Mantenha seus dados e chave PIX atualizados para comunicação rápida e recebimento automático de reembolsos e despesas.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">
              Seu Nome Completo <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3.5 text-text-tertiary">
                <User size={18} />
              </span>
              <input
                type="text"
                placeholder="Ex: Carlos da Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full bg-background-primary border border-border-secondary rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary focus:ring-2 focus:ring-info outline-none font-medium"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">
              WhatsApp <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3.5 text-text-tertiary">
                <Phone size={18} />
              </span>
              <input
                type="tel"
                placeholder="(00) 00000-0000"
                value={whatsapp}
                onChange={handleWhatsappChange}
                className="w-full bg-background-primary border border-border-secondary rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary focus:ring-2 focus:ring-info outline-none font-medium"
                required
              />
            </div>
          </div>

          {/* Seção de Cadastro do PIX */}
          <div className="bg-info/10 border border-info/20 rounded-xl p-3.5 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-info uppercase flex items-center gap-1.5">
                <CreditCard size={15} />
                Chave PIX para Reembolso
              </label>
              {whatsapp && (
                <button
                  type="button"
                  onClick={handleCopiarWhatsappParaPix}
                  className="text-[10px] font-bold text-info hover:text-info/80 hover:underline cursor-pointer flex items-center gap-1"
                  title="Usar número do WhatsApp como Chave PIX"
                >
                  <Sparkles size={11} />
                  Usar WhatsApp
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-text-tertiary uppercase mb-1">
                  Tipo de Chave
                </label>
                <select
                  value={tipoPix}
                  onChange={(e) => setTipoPix(e.target.value)}
                  className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-xs text-text-primary focus:ring-2 focus:ring-info outline-none"
                >
                  {TIPOS_PIX.map((t) => (
                    <option key={t} value={t} className="bg-slate-900 text-white">
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-tertiary uppercase mb-1">
                  Chave PIX
                </label>
                <input
                  type="text"
                  placeholder="Informe sua chave PIX..."
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-xs text-text-primary focus:ring-2 focus:ring-info outline-none font-mono"
                />
              </div>
            </div>

            <p className="text-[10px] text-text-tertiary leading-tight">
              💡 Essa chave será puxada e preenchida automaticamente sempre que você abrir uma solicitação de reembolso.
            </p>
          </div>

          <button
            type="submit"
            className="w-full mt-6 bg-info hover:bg-info/90 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-info/20 flex justify-center items-center active:scale-[0.98] transition-all cursor-pointer"
          >
            <Save className="mr-2" size={18} />
            Salvar Perfil
          </button>
        </form>

      </div>
    </div>
  );
}
