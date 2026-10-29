import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Common/Logo';

export function Privacidade() {
  return (
    <div className="min-h-screen bg-background-tertiary flex flex-col items-center justify-center p-6 text-text-primary">
      <div className="max-w-2xl w-full glass-panel rounded-2xl p-8 shadow-lg space-y-6">
        <div className="flex items-center gap-3 border-b border-border-secondary pb-4">
          <div className="w-12 h-12 rounded-xl bg-background-secondary border border-border-secondary flex items-center justify-center p-2 shadow-xs">
            <Logo className="w-full h-full" />
          </div>
          <div>
            <h1 className="text-xl font-bold">LogisTrack — RJ Alimentos</h1>
            <p className="text-xs text-text-secondary">Política de Privacidade e Proteção de Dados</p>
          </div>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-text-secondary leading-relaxed">
          <p>
            O <strong>LogisTrack</strong> é um sistema corporativo privado de gestão logística e monitoramento de entregas da <strong>RJ Alimentos</strong>.
          </p>
          <h2 className="text-sm font-bold text-text-primary">1. Coleta e Uso de Informações</h2>
          <p>
            O sistema coleta dados estritamente necessários para a execução dos serviços de entrega, acompanhamento de frota e prestação de contas, incluindo identificação de motoristas (placa e nome), notas fiscais, geolocalização durante rotas ativas e registros operacionais.
          </p>
          <h2 className="text-sm font-bold text-text-primary">2. Autenticação e Segurança</h2>
          <p>
            O acesso é restrito a colaboradores e motoristas autorizados da RJ Alimentos. A autenticação utiliza o serviço Google Identity / Firebase Authentication com tokens criptografados e controle estrito de permissões.
          </p>
          <h2 className="text-sm font-bold text-text-primary">3. Contato</h2>
          <p>
            Para dúvidas ou solicitações sobre o tratamento de dados no sistema, entre em contato com a equipe de TI / Logística pelo e-mail <strong>adson.sousa@rjalimentos.com.br</strong>.
          </p>
        </div>

        <div className="pt-4 border-t border-border-secondary flex justify-between items-center">
          <span className="text-[11px] text-text-tertiary">LogisTrack © 2026 RJ Alimentos</span>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-info text-white text-xs font-bold hover:bg-info/90 transition-all"
          >
            <ArrowLeft size={14} />
            <span>Voltar ao Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Privacidade;
