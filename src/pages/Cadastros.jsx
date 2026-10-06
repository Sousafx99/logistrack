import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AbaClientes } from '../components/cadastros/AbaClientes';
import { AbaVeiculos } from '../components/cadastros/AbaVeiculos';
import { AbaMotoristas } from '../components/cadastros/AbaMotoristas';
import { AbaGeolocalizacao } from '../components/cadastros/AbaGeolocalizacao';
import { AbaFuncionarios } from '../components/cadastros/AbaFuncionarios';

export function Cadastros() {
  const [searchParams] = useSearchParams();
  const abaParam = searchParams.get('aba') || 'clientes';
  
  // Normalizar aba ativa ('solicitacoes' e 'gps' mapeiam para 'geolocalizacao')
  const abaAtiva = useMemo(() => {
    if (abaParam === 'solicitacoes' || abaParam === 'gps') return 'geolocalizacao';
    if (['clientes', 'veiculos', 'motoristas', 'geolocalizacao', 'funcionarios'].includes(abaParam)) {
      return abaParam;
    }
    return 'clientes';
  }, [abaParam]);

  return (
    <div className="w-full pb-20">
      {abaAtiva === 'clientes' && <AbaClientes />}
      {abaAtiva === 'veiculos' && <AbaVeiculos />}
      {abaAtiva === 'motoristas' && <AbaMotoristas />}
      {abaAtiva === 'geolocalizacao' && <AbaGeolocalizacao />}
      {abaAtiva === 'funcionarios' && <AbaFuncionarios />}
    </div>
  );
}

export default Cadastros;
