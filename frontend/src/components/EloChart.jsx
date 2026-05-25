import React, { useState } from 'react';

const EloChart = ({ history = [1500] }) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Garantizar datos seguros
  const safeHistory = Array.isArray(history) && history.length > 0 ? history : [1500];
  const n = safeHistory.length;

  // Si hay un solo partido, duplicamos el punto inicial para dibujar una línea de partida
  const chartHistory = n === 1 ? [1500, safeHistory[0]] : safeHistory;
  const numHistPoints = chartHistory.length;

  // Calcular la pendiente de los últimos 3 partidos (tendencia de Elo)
  let slope = 0;
  if (numHistPoints > 1) {
    const k = Math.min(numHistPoints, 4); // miramos hasta los últimos 4 partidos
    slope = (chartHistory[numHistPoints - 1] - chartHistory[numHistPoints - k]) / (k - 1);
  }

  // Proyectar 3 futuros partidos basados en la tendencia
  const predictions = [];
  for (let p = 1; p <= 3; p++) {
    predictions.push(chartHistory[numHistPoints - 1] + slope * p);
  }

  // Armamos la lista completa de puntos a graficar
  const allPoints = [
    ...chartHistory.map((val, idx) => ({ val, isPrediction: false, step: idx + 1 })),
    ...predictions.map((val, idx) => ({ val, isPrediction: true, step: numHistPoints + idx }))
  ];

  const totalSlots = allPoints.length;

  // Dimensiones del SVG
  const viewBoxWidth = 500;
  const viewBoxHeight = 220;
  const paddingLeft = 50;
  const paddingRight = 35;
  const paddingTop = 25;
  const paddingBottom = 30;

  const widthRange = viewBoxWidth - paddingLeft - paddingRight;
  const heightRange = viewBoxHeight - paddingTop - paddingBottom;

  // Encontrar mínimos y máximos para ajustar la escala vertical
  const values = allPoints.map(p => p.val);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valDiff = maxVal - minVal;

  const yMin = minVal - (valDiff === 0 ? 50 : Math.max(valDiff * 0.25, 30));
  const yMax = maxVal + (valDiff === 0 ? 50 : Math.max(valDiff * 0.25, 30));

  // Función para obtener coordenadas x, y
  const getCoords = (idx, val) => {
    const x = paddingLeft + (idx * widthRange) / (totalSlots - 1);
    const y = viewBoxHeight - paddingBottom - ((val - yMin) / (yMax - yMin)) * heightRange;
    return { x, y };
  };

  // Coordenadas históricas
  const histCoords = chartHistory.map((val, idx) => getCoords(idx, val));
  const histPath = histCoords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = histCoords.length > 0 
    ? `${histPath} L ${histCoords[histCoords.length - 1].x} ${viewBoxHeight - paddingBottom} L ${histCoords[0].x} ${viewBoxHeight - paddingBottom} Z` 
    : '';

  // Coordenadas predictivas (conectando el último punto histórico con las proyecciones)
  const predPoints = [chartHistory[numHistPoints - 1], ...predictions];
  const predCoords = predPoints.map((val, idx) => getCoords(numHistPoints - 1 + idx, val));
  const predPath = predCoords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  // Definir color de tendencia (Lime Volt para tendencia positiva, Cyan para negativa/neutra)
  const lastChange = numHistPoints > 1 ? chartHistory[numHistPoints - 1] - chartHistory[numHistPoints - 2] : 0;
  const lineColor = lastChange >= 0 ? 'var(--volt-lime)' : 'var(--electric-cyan)';
  const areaGradId = lastChange >= 0 ? 'area-grad-volt' : 'area-grad-cyan';
  const filterId = lastChange >= 0 ? 'glow-volt' : 'glow-cyan';

  // Divisiones horizontales para la cuadrícula (3 líneas)
  const gridLines = [
    yMin + (yMax - yMin) * 0.25,
    yMin + (yMax - yMin) * 0.5,
    yMin + (yMax - yMin) * 0.75
  ];

  // Línea divisoria vertical entre Historial y Predicción
  const dividerX = getCoords(numHistPoints - 1, chartHistory[numHistPoints - 1]).x;

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '600px', background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', padding: '0 0.5rem' }}>
        <h4 style={{ color: 'var(--pure-white)', fontSize: '0.9rem', margin: 0, letterSpacing: '2px', fontFamily: 'var(--font-primary)' }}>EVOLUCIÓN MMR</h4>
        <span style={{ color: lineColor, fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'var(--font-secondary)' }}>
          TENDENCIA: {lastChange > 0 ? `+${Math.round(lastChange)}` : Math.round(lastChange)} MMR
        </span>
      </div>

      <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        <defs>
          <filter id="glow-volt" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <linearGradient id="area-grad-volt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--volt-lime)" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="var(--volt-lime)" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="area-grad-cyan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--electric-cyan)" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="var(--electric-cyan)" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* Cuadrícula horizontal (Líneas de fondo) */}
        {gridLines.map((val, idx) => {
          const y = viewBoxHeight - paddingBottom - ((val - yMin) / (yMax - yMin)) * heightRange;
          return (
            <g key={idx}>
              <line x1={paddingLeft} y1={y} x2={viewBoxWidth - paddingRight} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4,4" />
              <text x={paddingLeft - 8} y={y + 3} fill="var(--off-white)" fontSize="9px" textAnchor="end" fontFamily="var(--font-secondary)">{Math.round(val)}</text>
            </g>
          );
        })}

        {/* Línea divisoria vertical Historial / Predicción */}
        <line x1={dividerX} y1={paddingTop} x2={dividerX} y2={viewBoxHeight - paddingBottom} stroke="rgba(255,255,255,0.15)" strokeDasharray="3,3" />
        <text x={dividerX - 8} y={paddingTop + 10} fill="var(--off-white)" fontSize="8px" fontWeight="bold" textAnchor="end" letterSpacing="1px">HISTORIAL</text>
        <text x={dividerX + 8} y={paddingTop + 10} fill="var(--ultimate-gold)" fontSize="8px" fontWeight="bold" textAnchor="start" letterSpacing="1px">PROYECCIÓN 🔮</text>

        {/* Eje X base */}
        <line x1={paddingLeft} y1={viewBoxHeight - paddingBottom} x2={viewBoxWidth - paddingRight} y2={viewBoxHeight - paddingBottom} stroke="rgba(255,255,255,0.1)" />

        {/* Área rellenada para historial */}
        {areaPath && (
          <path d={areaPath} fill={`url(#${areaGradId})`} />
        )}

        {/* Línea de historial */}
        {histPath && (
          <path d={histPath} fill="none" stroke={lineColor} strokeWidth="3" filter={`url(#${filterId})`} strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Línea de predicción (dorada punteada) */}
        {predPath && (
          <path d={predPath} fill="none" stroke="var(--ultimate-gold)" strokeWidth="2" strokeDasharray="4,4" filter="url(#glow-gold)" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Rombos (Data Points) */}
        {allPoints.map((p, idx) => {
          const { x, y } = getCoords(idx, p.val);
          const isPred = p.isPrediction;
          const color = isPred ? 'var(--ultimate-gold)' : lineColor;

          // Polígono para dibujar un rombo
          const pointsString = `${x},${y - 4} ${x + 4},${y} ${x},${y + 4} ${x - 4},${y}`;

          return (
            <g key={idx}>
              {/* Círculo invisible más grande para facilitar el hover en móviles */}
              <circle cx={x} cy={y} r="10" fill="transparent" style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPoint({ x, y, value: p.val, step: p.step, isPrediction: isPred })}
                onMouseLeave={() => setHoveredPoint(null)}
              />
              {/* Rombo real */}
              <polygon points={pointsString} fill="var(--pitch-black)" stroke={color} strokeWidth="2.5" pointerEvents="none" />
            </g>
          );
        })}
      </svg>

      {/* Tooltip interactivo */}
      {hoveredPoint && (
        <div style={{
          position: 'absolute',
          left: `${(hoveredPoint.x / viewBoxWidth) * 100}%`,
          top: `${(hoveredPoint.y / viewBoxHeight) * 100 - 15}%`,
          transform: 'translate(-50%, -100%)',
          background: 'var(--dark-onyx)',
          border: `1px solid ${hoveredPoint.isPrediction ? 'var(--ultimate-gold)' : lineColor}`,
          padding: '0.4rem 0.7rem',
          borderRadius: '4px',
          fontFamily: 'var(--font-primary)',
          fontSize: '0.75rem',
          boxShadow: `0 0 10px ${hoveredPoint.isPrediction ? 'rgba(255,215,0,0.3)' : 'rgba(0,240,255,0.2)'}`,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
          animation: 'fadeIn 0.15s ease-out'
        }}>
          <span style={{ color: 'var(--off-white)', display: 'block', fontSize: '0.65rem', marginBottom: '2px', textTransform: 'uppercase' }}>
            {hoveredPoint.isPrediction ? `PRED. PARTIDO +${hoveredPoint.step - numHistPoints + 1}` : `PARTIDO #${hoveredPoint.step}`}
          </span>
          <span style={{ color: 'white', fontWeight: '900', fontSize: '0.9rem' }}>
            {Math.round(hoveredPoint.value)} MMR
          </span>
        </div>
      )}
    </div>
  );
};

export default EloChart;
