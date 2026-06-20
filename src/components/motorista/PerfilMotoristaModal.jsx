import { useState, useEffect } from 'react';
import { User, Phone, Save, X } from 'lucide-react';

export function PerfilMotoristaModal({ isOpen, onClose, onSave, dadosIniciais }) {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  useEffect(() => {
    if (dadosIniciais) {
      setNome(dadosIniciais.nome || '');
      setWhatsapp(dadosIniciais.whatsapp || '');
    }
  }, [dadosIniciais]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome.trim() || !whatsapp.trim()) {
      alert('Por favor, preencha o Nome e o WhatsApp.');
      return;
    }
    onSave({ nome: nome.trim(), whatsapp: whatsapp.trim() });
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

  return (
    <div className="fixed inset-0 z-[60] bg-background-primary/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-background-secondary w-full max-w-sm rounded-2xl shadow-2xl border border-border-secondary p-6 animate-in zoom-in-95">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-text-primary flex items-center">
            <User className="mr-2 text-info" />
            Perfil do Motorista
          </h2>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 text-text-tertiary hover:text-text-primary bg-background-primary rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          Para facilitar a comunicação com a equipe de monitoramento, por favor informe seu nome e número de WhatsApp.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Seu Nome Completo</label>
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
            <label className="block text-xs font-bold text-text-secondary uppercase mb-2">WhatsApp</label>
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

          <button
            type="submit"
            className="w-full mt-6 bg-info hover:bg-info/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-info/20 flex justify-center items-center active:scale-[0.98] transition-all"
          >
            <Save className="mr-2" size={20} />
            Salvar Perfil
          </button>
        </form>

      </div>
    </div>
  );
}
