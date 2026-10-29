import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Lock, FileText, CheckCircle2 } from 'lucide-react';
import { Logo } from '../components/Common/Logo';

export function Privacidade() {
  return (
    <div className="min-h-screen bg-background-tertiary flex flex-col items-center justify-center p-4 sm:p-6 text-text-primary">
      <div className="max-w-3xl w-full glass-panel rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-border-secondary pb-5">
          <div className="w-12 h-12 rounded-xl bg-background-secondary border border-border-secondary flex items-center justify-center p-2 shadow-xs shrink-0">
            <Logo className="w-full h-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold">LogisTrack</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-info/10 text-info border border-info/20">
                Oficial
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Política de Privacidade e Termos de Uso — Propriedade Intelectual & Plataforma por Adson Sousa
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-text-secondary leading-relaxed max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          <section className="space-y-1.5">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-info" /> 1. Titularidade e Natureza da Plataforma
            </h2>
            <p>
              O <strong>LogisTrack</strong> é um software como serviço (SaaS) e plataforma tecnológica independente de monitoramento de frota, rastreamento logístico e gestão de cargas, de <strong>autoria, titularidade e propriedade intelectual exclusiva de Adson dos Santos Sousa</strong>.
            </p>
            <p>
              A plataforma é licenciada para operadores logísticos, transportadoras parceiras e centros de distribuição para gestão de fluxos de entregas e prestação de contas operacionais.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
              <Lock size={16} className="text-info" /> 2. Coleta de Dados e Finalidade
            </h2>
            <p>
              O sistema coleta e processa exclusivamente informações indispensáveis para a operação logística autorizada:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-text-secondary">
              <li><strong>Dados de Acesso:</strong> e-mails corporativos autorizados e identificação de veículos (placas) para autenticação segura.</li>
              <li><strong>Localização e Telemetria:</strong> coordenadas geográficas (GPS) obtidas durante rotas ativas para acompanhamento do progresso das entregas.</li>
              <li><strong>Dados Operacionais:</strong> registros de notas fiscais, fotos de canhotos, comprovantes e valores operacionais de prestação de contas.</li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
              <FileText size={16} className="text-info" /> 3. Integração com Serviços Google e Autenticação
            </h2>
            <p>
              O acesso à plataforma pode utilizar a autenticação federada Google Identity. Os dados do perfil Google (nome, endereço de e-mail e ID único) são utilizados estritamente para validar a identidade do colaborador na lista de operadores autorizados, não sendo compartilhados com terceiros para fins de publicidade.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-info" /> 4. Contato do Desenvolvedor e Encarregado
            </h2>
            <p>
              Para suporte técnico, esclarecimentos sobre a plataforma ou solicitações de titulares de dados:
            </p>
            <p className="font-mono text-xs text-text-primary bg-background-primary p-2.5 rounded-xl border border-border-secondary">
              Adson dos Santos Sousa • Desenvolvedor & Titular da Plataforma LogisTrack<br/>
              E-mail direto: adson.sousa@rjalimentos.com.br / adson.sousa0708@gmail.com
            </p>
          </section>
        </div>

        <div className="pt-4 border-t border-border-secondary flex justify-between items-center gap-3">
          <span className="text-[11px] text-text-tertiary">LogisTrack Platform © 2026 • Todos os direitos reservados</span>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-info text-white text-xs font-bold hover:bg-info/90 transition-all shadow-xs"
          >
            <ArrowLeft size={14} />
            <span>Voltar ao Sistema</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Privacidade;
