import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin, Navigation, Route, Truck, Clock, AlertTriangle, Eye } from 'lucide-react';
import { cn } from '../../lib/utils';

const CORES_ROTAS = [
  '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777',
  '#0891b2', '#ea580c', '#4f46e5', '#16a34a', '#dc2626'
];

// Coordenadas padrão da base de operações: Salvador e Região Metropolitana (Bahia)
const CENTRO_PADRAO_SALVADOR = [-12.9777, -38.5016];
const ZOOM_PADRAO_SALVADOR = 11;

function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatarHoraCurta(iso) {
  if (!iso) return '--:--';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

function minutosDesde(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function MapaRastreamentoFrota({
  carros = [],
  rastreamentoFrota = [],
  rotasGps = [],
  clientesGeoloc = [],
  motoristas = [],
  datasEfetivas = [],
  mostraTodas = false,
  placaSelecionada = '',
  onSelectPlaca
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const [mostrarClientesRota, setMostrarClientesRota] = useState(true);

  const veiculosRastreados = useMemo(() => {
    const mapPlacas = new Map();

    // 1. Placas com carga nas datas filtradas
    (carros || []).forEach((c) => {
      mapPlacas.set(c.placa, {
        placa: c.placa,
        statusFrota: c.status,
        pendentes: c.pendentes,
        totalNotas: c.total,
        notas: c.notas || [],
        live: null,
        pontos: []
      });
    });

    // 2. Dados ao vivo de rastreamento_frota
    const hojeIso = new Date().toISOString().slice(0, 10);
    (rastreamentoFrota || []).forEach((r) => {
      const p = String(r.placa || r.id || '').trim().toUpperCase();
      if (!p) return;
      const isRecenteHoje = r.data === hojeIso || (r.atualizadoEm && (Date.now() - new Date(r.atualizadoEm).getTime() < 18 * 60 * 60 * 1000));
      const matchData = mostraTodas || datasEfetivas.length === 0 || !r.data || datasEfetivas.includes(r.data) || isRecenteHoje;
      if (!matchData && !mapPlacas.has(p)) return;

      const statusCalculado = r.emRota ? 'Em Rota' : (r.isFinalizado ? 'Finalizado' : 'Conectado');

      if (!mapPlacas.has(p)) {
        mapPlacas.set(p, {
          placa: p,
          statusFrota: statusCalculado,
          pendentes: 0,
          totalNotas: 0,
          notas: [],
          live: r,
          pontos: []
        });
      } else {
        const item = mapPlacas.get(p);
        item.live = r;
        if (!r.emRota && item.pendentes === item.totalNotas && item.totalNotas > 0) {
          item.statusFrota = 'Conectado';
        }
      }
    });

    // 3. Trajetos (pontos a cada 5 min) de rotas_gps
    (rotasGps || []).forEach((rg) => {
      const p = String(rg.placa || '').trim().toUpperCase();
      if (!p) return;
      const matchData = mostraTodas || datasEfetivas.length === 0 || !rg.data || datasEfetivas.includes(rg.data);
      if (!matchData) return;

      if (!mapPlacas.has(p)) {
        mapPlacas.set(p, {
          placa: p,
          statusFrota: 'Em Rota',
          pendentes: 0,
          totalNotas: 0,
          notas: [],
          live: null,
          pontos: []
        });
      }

      const item = mapPlacas.get(p);
      const pts = Array.isArray(rg.pontos) ? rg.pontos : [];
      item.pontos = [...item.pontos, ...pts];
    });

    const lista = Array.from(mapPlacas.values()).map((v, idx) => {
      const mot = (motoristas || []).find(
        (m) => String(m.placa || '').trim().toUpperCase() === v.placa
      );
      const pontosOrdenados = [...v.pontos]
        .filter((pt) => Number.isFinite(Number(pt.lat)) && Number.isFinite(Number(pt.lng)))
        .sort((a, b) => String(a.t || '').localeCompare(String(b.t || '')));

      const ultimoPontoTrajeto = pontosOrdenados[pontosOrdenados.length - 1] || null;
      const latAtual = Number.isFinite(Number(v.live?.lat))
        ? Number(v.live.lat)
        : (ultimoPontoTrajeto ? Number(ultimoPontoTrajeto.lat) : null);
      const lngAtual = Number.isFinite(Number(v.live?.lng))
        ? Number(v.live.lng)
        : (ultimoPontoTrajeto ? Number(ultimoPontoTrajeto.lng) : null);

      let kmTrajeto = 0;
      for (let i = 1; i < pontosOrdenados.length; i++) {
        kmTrajeto += calcularDistanciaKm(
          Number(pontosOrdenados[i - 1].lat),
          Number(pontosOrdenados[i - 1].lng),
          Number(pontosOrdenados[i].lat),
          Number(pontosOrdenados[i].lng)
        );
      }

      const atualizadoEm = v.live?.atualizadoEm || ultimoPontoTrajeto?.t || null;
      const mins = minutosDesde(atualizadoEm);
      const gpsAtivo = v.live ? v.live.gpsAtivo !== false : Boolean(ultimoPontoTrajeto);

      return {
        ...v,
        cor: CORES_ROTAS[idx % CORES_ROTAS.length],
        motoristaNome: v.live?.motoristaNome || mot?.nome || 'Sem motorista',
        pontos: pontosOrdenados,
        lat: latAtual,
        lng: lngAtual,
        temCoordenada: Number.isFinite(latAtual) && Number.isFinite(lngAtual),
        kmTrajeto: Number(kmTrajeto.toFixed(1)),
        speedKmh: v.live?.speedKmh ?? ultimoPontoTrajeto?.v ?? 0,
        atualizadoEm,
        minutosSemSinal: mins,
        gpsAtivo
      };
    });

    return lista.sort((a, b) => {
      if (a.temCoordenada !== b.temCoordenada) return a.temCoordenada ? -1 : 1;
      return a.placa.localeCompare(b.placa);
    });
  }, [carros, rastreamentoFrota, rotasGps, motoristas, datasEfetivas, mostraTodas]);

  const veiculoFocado = useMemo(
    () => veiculosRastreados.find((v) => v.placa === placaSelecionada) || null,
    [veiculosRastreados, placaSelecionada]
  );

  // Inicializa instância Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: CENTRO_PADRAO_SALVADOR, // Salvador e RMS - Bahia
      zoom: ZOOM_PADRAO_SALVADOR,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Desenha marcadores e linhas de trajeto (Polylines)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const boundsPoints = [];

    const listaExibida = placaSelecionada
      ? veiculosRastreados.filter((v) => v.placa === placaSelecionada)
      : veiculosRastreados;

    listaExibida.forEach((v) => {
      const corLinha = placaSelecionada ? '#2563eb' : v.cor;

      // 1. Desenha linha de trajeto (Polyline) se houver >= 2 coordenadas
      if (v.pontos.length >= 2) {
        const latlngs = v.pontos.map((pt) => [Number(pt.lat), Number(pt.lng)]);
        latlngs.forEach((ll) => boundsPoints.push(ll));

        // Contorno claro para alto contraste sobre qualquer mapa
        L.polyline(latlngs, {
          color: '#ffffff',
          weight: placaSelecionada ? 8 : 5,
          opacity: 0.85,
          lineJoin: 'round'
        }).addTo(group);

        // Linha principal da rota
        L.polyline(latlngs, {
          color: corLinha,
          weight: placaSelecionada ? 5 : 3.5,
          opacity: 0.95,
          lineJoin: 'round'
        }).addTo(group);

        // Marcador de Início da Rota
        const ptInicio = v.pontos[0];
        const startIcon = L.divIcon({
          className: 'lt-gps-start-icon',
          html: `<div style="background:#059669;color:#fff;font-weight:900;font-size:10px;padding:2px 6px;border-radius:999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);white-space:nowrap;">▶ ${escapeHtml(formatarHoraCurta(ptInicio.t))}</div>`,
          iconSize: [64, 22],
          iconAnchor: [32, 11]
        });
        L.marker([Number(ptInicio.lat), Number(ptInicio.lng)], { icon: startIcon })
          .bindPopup(
            `<div style="font-size:12px;"><strong>Início do Trajeto — ${escapeHtml(v.placa)}</strong><br/>Horário: ${escapeHtml(formatarHoraCurta(ptInicio.t))}</div>`
          )
          .addTo(group);

        // Pontos intermediários de 5 em 5 min quando um veículo específico está selecionado
        if (placaSelecionada) {
          v.pontos.slice(1, -1).forEach((pt, idxPt) => {
            L.circleMarker([Number(pt.lat), Number(pt.lng)], {
              radius: 5,
              color: '#ffffff',
              weight: 2,
              fillColor: corLinha,
              fillOpacity: 1
            })
              .bindPopup(
                `<div style="font-size:12px;"><strong>Ponto #${idxPt + 2} (${escapeHtml(v.placa)})</strong><br/>Horário: <strong>${escapeHtml(formatarHoraCurta(pt.t))}</strong><br/>Velocidade: ${Number(pt.v || 0)} km/h</div>`
              )
              .addTo(group);
          });
        }
      }

      // 2. Marcador atual do Caminhão
      if (v.temCoordenada) {
        boundsPoints.push([v.lat, v.lng]);
        const bgBadge = !v.gpsAtivo
          ? '#dc2626'
          : v.statusFrota === 'Finalizado'
            ? '#059669'
            : v.statusFrota === 'Conectado'
              ? '#0284c7'
              : corLinha;

        const truckIcon = L.divIcon({
          className: 'lt-gps-truck-icon',
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px);">
              <div style="background:${bgBadge};color:#fff;font-weight:900;font-size:11px;padding:3px 8px;border-radius:8px;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.35);white-space:nowrap;display:flex;align-items:center;gap:4px;">
                <span>🚛 ${escapeHtml(v.placa)}</span>
              </div>
              <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${bgBadge};margin-top:-1px;"></div>
            </div>
          `,
          iconSize: [96, 34],
          iconAnchor: [48, 30]
        });

        const marker = L.marker([v.lat, v.lng], { icon: truckIcon });
        marker.bindPopup(`
          <div style="font-size:12px;min-width:170px;line-height:1.45;">
            <div style="font-weight:900;font-size:13px;margin-bottom:2px;">${escapeHtml(v.placa)} — ${escapeHtml(v.statusFrota)}</div>
            <div>Motorista: <strong>${escapeHtml(v.motoristaNome.split(' ')[0])}</strong></div>
            <div>Último sinal: <strong>${escapeHtml(formatarHoraCurta(v.atualizadoEm))}</strong></div>
            <div>Velocidade: <strong>${Number(v.speedKmh || 0)} km/h</strong></div>
            <div>GPS: <strong style="color:${v.gpsAtivo ? '#059669' : '#dc2626'}">${v.gpsAtivo ? 'Ativo' : 'Desativado'}</strong></div>
            ${v.pontos.length > 1 ? `<div>Trajeto: <strong>${v.pontos.length} pontos (${v.kmTrajeto} km)</strong></div>` : ''}
          </div>
        `);
        marker.on('click', () => {
          if (onSelectPlaca && placaSelecionada !== v.placa) {
            onSelectPlaca(v.placa);
          }
        });
        marker.addTo(group);
      }

      // 3. Marcadores dos clientes da rota quando uma placa está selecionada
      if (placaSelecionada && mostrarClientesRota && v.notas.length > 0) {
        const vistos = new Set();
        v.notas.forEach((nota) => {
          const cod = String(nota.codCliente || '').trim();
          if (!cod || vistos.has(cod)) return;
          vistos.add(cod);

          const cliGeo = (clientesGeoloc || []).find(
            (cg) => String(cg.codCliente || cg.id || '').trim() === cod
          );
          const pontoCli = cliGeo?.pontos?.find((p) => p.padrao) || cliGeo?.pontos?.[0];
          if (!pontoCli || !Number.isFinite(Number(pontoCli.lat)) || !Number.isFinite(Number(pontoCli.lng))) {
            return;
          }

          const latCli = Number(pontoCli.lat);
          const lngCli = Number(pontoCli.lng);
          boundsPoints.push([latCli, lngCli]);

          const isEntregue = nota.status === 'Entrega total';
          const isDev = nota.status === 'Devolução total' || nota.status === 'Entrega parcial';
          const corCli = isEntregue ? '#10b981' : isDev ? '#ef4444' : '#f59e0b';

          L.circleMarker([latCli, lngCli], {
            radius: 7,
            color: '#ffffff',
            weight: 2,
            fillColor: corCli,
            fillOpacity: 0.95
          })
            .bindPopup(
              `<div style="font-size:12px;"><strong>📦 ${escapeHtml(nota.cliente)}</strong><br/>Bairro: ${escapeHtml(nota.bairro || 'N/D')}<br/>Status: <strong>${escapeHtml(nota.status)}</strong></div>`
            )
            .addTo(group);
        });
      }
    });

    if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14, { animate: true });
    } else if (boundsPoints.length > 1) {
      map.fitBounds(boundsPoints, { padding: [38, 38], maxZoom: 15 });
    } else {
      // Quando não houver veículos com coordenadas, centraliza em Salvador/RMS
      map.setView(CENTRO_PADRAO_SALVADOR, ZOOM_PADRAO_SALVADOR, { animate: true });
    }
  }, [veiculosRastreados, placaSelecionada, mostrarClientesRota, clientesGeoloc, onSelectPlaca]);

  const totalComCoordenada = veiculosRastreados.filter((v) => v.temCoordenada).length;

  return (
    <div className="glass-panel rounded-2xl border border-border-secondary overflow-hidden shadow-md space-y-0">
      {/* Barra de Seleção de Placa & Resumo de Trajeto */}
      <div className="p-3 bg-background-secondary/80 border-b border-border-secondary space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-info/15 text-info border border-info/25">
              <Route size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-text-primary leading-tight">
                Mapa ao Vivo &amp; Trajeto da Frota
              </h3>
              <p className="text-[11px] text-text-secondary">
                Coleta automática a cada 5 min do início ao fim da rota • {totalComCoordenada} veículo(s) com sinal no mapa
              </p>
            </div>
          </div>

          {placaSelecionada && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMostrarClientesRota((v) => !v)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer",
                  mostrarClientesRota
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-background-primary text-text-secondary border-border-secondary"
                )}
              >
                <MapPin size={13} />
                <span>Clientes da Rota</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectPlaca && onSelectPlaca('')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-background-primary hover:bg-background-tertiary text-text-primary border border-border-secondary transition-colors cursor-pointer flex items-center gap-1"
              >
                <Eye size={13} />
                <span>Ver Toda a Frota</span>
              </button>
            </div>
          )}
        </div>

        {/* Pílulas de Placas */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => onSelectPlaca && onSelectPlaca('')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap transition-all shrink-0 cursor-pointer",
              !placaSelecionada
                ? "bg-info text-white border-info shadow-sm"
                : "bg-background-primary text-text-secondary border-border-secondary hover:text-text-primary"
            )}
          >
            Todos ({veiculosRastreados.length})
          </button>

          {veiculosRastreados.map((v) => {
            const ativo = placaSelecionada === v.placa;
            return (
              <button
                key={v.placa}
                type="button"
                onClick={() => onSelectPlaca && onSelectPlaca(ativo ? '' : v.placa)}
                className={cn(
                  "px-2.5 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 cursor-pointer",
                  ativo
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-background-primary text-text-primary border-border-secondary hover:border-info"
                )}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    !v.temCoordenada
                      ? "bg-zinc-400"
                      : !v.gpsAtivo
                        ? "bg-danger"
                        : "bg-emerald-500"
                  )}
                />
                <span>{v.placa}</span>
                {v.pontos.length > 1 && (
                  <span className={cn(
                    "text-[10px] px-1.5 rounded-full font-extrabold",
                    ativo ? "bg-white/20 text-white" : "bg-info/15 text-info"
                  )}>
                    {v.pontos.length} pts
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Resumo do Trajeto do Veículo Selecionado */}
        {veiculoFocado && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="bg-background-primary px-3 py-2 rounded-xl border border-border-secondary">
              <span className="block text-[10px] uppercase font-bold text-text-tertiary">Motorista / Status</span>
              <span className="text-xs font-black text-text-primary truncate block">
                {veiculoFocado.motoristaNome.split(' ')[0]} • {veiculoFocado.statusFrota}
              </span>
            </div>
            <div className="bg-background-primary px-3 py-2 rounded-xl border border-border-secondary">
              <span className="block text-[10px] uppercase font-bold text-text-tertiary">Sinal do GPS</span>
              <span className={cn(
                "text-xs font-black flex items-center gap-1",
                !veiculoFocado.temCoordenada
                  ? "text-text-tertiary"
                  : veiculoFocado.gpsAtivo
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-danger"
              )}>
                <LocateFixed size={13} />
                {!veiculoFocado.temCoordenada
                  ? 'Aguardando 1º sinal'
                  : veiculoFocado.gpsAtivo
                    ? `Ativo (${formatarHoraCurta(veiculoFocado.atualizadoEm)})`
                    : 'GPS Desligado'}
              </span>
            </div>
            <div className="bg-background-primary px-3 py-2 rounded-xl border border-border-secondary">
              <span className="block text-[10px] uppercase font-bold text-text-tertiary">Pontos Coletados</span>
              <span className="text-xs font-black text-info">
                {veiculoFocado.pontos.length} registros (5/5 min)
              </span>
            </div>
            <div className="bg-background-primary px-3 py-2 rounded-xl border border-border-secondary">
              <span className="block text-[10px] uppercase font-bold text-text-tertiary">Distância em Linha</span>
              <span className="text-xs font-black text-text-primary">
                ~{veiculoFocado.kmTrajeto} km • {veiculoFocado.speedKmh || 0} km/h
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Container do Mapa Interativo Leaflet */}
      <div className="relative w-full h-[430px] sm:h-[520px] bg-background-primary">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
        {totalComCoordenada === 0 && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm z-[400] bg-background-secondary/95 backdrop-blur-md border border-border-secondary rounded-xl p-3 shadow-lg flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-text-primary">Nenhum sinal GPS recebido para esta data ainda</p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Assim que os motoristas iniciarem a viagem (KM Inicial) com o GPS ligado, os caminhões e o risco do trajeto aparecerão aqui automaticamente.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
