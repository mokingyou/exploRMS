import React, { useState, useEffect, useCallback } from 'react';
import { InlineMath, BlockMath } from 'react-katex'; 
import './styles.css';
import 'katex/dist/katex.min.css';

// ... (Utility functions: clampDim, randn, generateMatrix, matMul, computeNorm remain unchanged) ...

const MAX_DIM = 32;
const MIN_DIM = 1;
const DRAG_SCALE = 0.4; // pixels -> dimension increments

function clampDim(v) {
  return Math.max(MIN_DIM, Math.min(MAX_DIM, Math.round(v)));
}

function randn() {
  let u1 = Math.random();
  let u2 = Math.random();
  u1 = u1 === 0 ? 1e-12 : u1;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function generateMatrix(rows, cols, config, fanInfo = null) {
  const { initType, mean, std, constant, scale } = config;
  const mat = Array.from({ length: rows }, () => Array(cols).fill(0));

  let effectiveStd = std;

  if (initType === 'xavier' && fanInfo) {
    const { fanIn, fanOut } = fanInfo;
    const xavierStd = Math.sqrt(2 / (fanIn + fanOut));
    
    if (std === 0) {
      effectiveStd = xavierStd;
    } else {
      effectiveStd = std;
    }
  }

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let v = 0;
      if (initType === 'constant') {
        v = constant;
      } else if (initType === 'normal' || initType === 'xavier') {
        v = mean + effectiveStd * randn();
      } else {
        v = 0;
      }
      mat[i][j] = v * scale;
    }
  }
  return mat;
}

function matMul(A, B) {
  const m = A.length;
  const k = A[0]?.length || 0;
  const n = B[0]?.length || 0;
  
  if (k === 0 || n === 0) return Array.from({ length: m }, () => Array(n).fill(0));

  const C = Array.from({ length: m }, () => Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let t = 0; t < k; t++) {
        sum += A[i][t] * B[t][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
}

function computeNorm(matrix, type) {
  const flat = matrix.flat();
  const n = flat.length;
  
  if (n === 0) return 0;

  if (type === 'RMS') {
    let sumSq = 0;
    for (const x of flat) sumSq += x * x;
    return Math.sqrt(sumSq / n);
  } else if (type === 'L2') {
    let sumSq = 0;
    for (const x of flat) sumSq += x * x;
    return Math.sqrt(sumSq);
  } else if (type === 'L1') {
    let sumAbs = 0;
    for (const x of flat) sumAbs += Math.abs(x);
    return sumAbs;
  }
  return 0;
}


// --- NEW COMPONENT: NormCard ---
function NormCard({ name, vectorMath, matrixMath, isSelected, onSelect }) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleClick = () => {
    // If the card is not selected, select it first.
    if (!isSelected) {
      onSelect(name);
    } 
    // Always toggle flip state when clicked
    setIsFlipped(prev => !prev);
  };
  
  // Unflip card if a different norm is selected
  useEffect(() => {
    if (!isSelected && isFlipped) {
      setIsFlipped(false);
    }
  }, [isSelected, isFlipped]);

  const cardClasses = `norm-card ${isFlipped ? 'is-flipped' : ''} ${isSelected ? 'is-active' : ''}`;

  return (
    <div className={cardClasses} onClick={handleClick}>
      {!isFlipped ? (
        // FRONT: just the name
        <div className="norm-card-front">
          <h3>{name} Norm</h3>
        </div>
      ) : (
        // BACK: equations
        <div className="norm-card-face norm-card-back">
            <div className="norm-card-eqs">
                <div className="norm-card-row">
                <div className="norm-card-row-label">
                    Vector <InlineMath math={'x \\in \\mathbb{R}^n'} />
                </div>
                <div className="norm-card-row-math">
                    <InlineMath math={vectorMath} />
                </div>
                </div>

                <div className="norm-card-row">
                <div className="norm-card-row-label">
                    Matrix <InlineMath math={'A \\in \\mathbb{R}^{m \\times n}'} />
                </div>
                <div className="norm-card-row-math">
                    <InlineMath math={matrixMath} />
                </div>
                </div>
            </div>
            </div>
      )}
    </div>
  );
}
// --- END NEW COMPONENT ---


// ... (MatrixShape and InitControls components remain unchanged) ...

function MatrixShape({ label, rows, cols, colorClass, onResize }) {
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0, rows, cols });

  const widthPx = Math.max(40, 80 + cols * 8); 
  const heightPx = Math.max(40, 80 + rows * 8);

  const handleMouseDown = (e) => {
    e.preventDefault();
    if (!e.target.classList.contains('matrix-handle')) return; 
    setDragging(true);
    setStart({ x: e.clientX, y: e.clientY, rows, cols });
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!dragging) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      const newCols = clampDim(start.cols + dx * DRAG_SCALE * 0.05);
      const newRows = clampDim(start.rows + dy * DRAG_SCALE * 0.05);

      onResize(newRows, newCols);
    },
    [dragging, start, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="matrix-outer">
      <div className={`matrix-rect ${colorClass}`} style={{ width: widthPx, height: heightPx }}>
        <div className="matrix-label">{label}</div>
        <div className="matrix-dims">
          <InlineMath math={`${rows} \\times ${cols}`} />
        </div>
        <div className="matrix-handle" onMouseDown={handleMouseDown} />
      </div>
    </div>
  );
}

function InitControls({ title, config, onChange, fanInfo }) {
  const handleChange = (key, value) => {
    let parsed;
    if (['mean', 'std', 'constant', 'scale'].includes(key)) {
      parsed = parseFloat(value);
      parsed = isNaN(parsed) ? 0 : parsed;
    } else {
      parsed = value;
    }
    onChange({ ...config, [key]: parsed });
  };

  let xavierStdInfo = null;
  if (config.initType === 'xavier' && fanInfo) {
    const { fanIn, fanOut } = fanInfo;
    const xavierStd = Math.sqrt(2 / (fanIn + fanOut));
    xavierStdInfo = xavierStd.toFixed(4);
  }

  return (
    <div className="init-controls">
      <div className="init-title">{title}</div>
      <label className="field">
        <span>Initialization</span>
        <select
          value={config.initType}
          onChange={(e) => handleChange('initType', e.target.value)} 
        >
          <option value="xavier">Xavier (Normal)</option>
          <option value="normal">Normal</option>
          <option value="constant">Constant</option>
        </select>
      </label>

      {(config.initType === 'normal' || config.initType === 'xavier') && (
        <>
          <label className="field">
            <span>Mean (<InlineMath math={'\\mu'} />)</span>
            <input
              type="number"
              step="0.1"
              value={config.mean}
              onChange={(e) => handleChange('mean', e.target.value)}
            />
          </label>
          <label className="field">
            <span>Std Dev (<InlineMath math={'\\sigma'} />)</span>
            <input
              type="number"
              step="0.1"
              value={config.std}
              onChange={(e) => handleChange('std', e.target.value)}
            />
          </label>
          {config.initType === 'xavier' && fanInfo && (
            <div className="hint">
              Suggested Xavier <InlineMath math={'\\sigma'} /> (when <InlineMath math={'\\sigma=0'} />) <InlineMath math={'\\approx'} /> <InlineMath math={xavierStdInfo} />
            </div>
          )}
        </>
      )}

      {config.initType === 'constant' && (
        <label className="field">
          <span>Value</span>
          <input
            type="number"
            step="0.1"
            value={config.constant}
            onChange={(e) => handleChange('constant', e.target.value)}
          />
        </label>
      )}

      <label className="field">
        <span>Scale factor (<InlineMath math={'\\alpha'} />)</span>
        <input
          type="range"
          min="0"
          max="5"
          step="0.05"
          value={config.scale}
          onChange={(e) => handleChange('scale', e.target.value)}
        />
        <span className="scale-value">{config.scale.toFixed(2)}</span>
      </label>
    </div>
  );
}

export default function App() {
  const [dims, setDims] = useState({ m: 8, k: 8, n: 8 });
  const [normType, setNormType] = useState('RMS'); // State to track selected norm

  const normDefinitions = {
    RMS: {
      vectorMath: '\\text{RMS}(x) = \\sqrt{\\frac{1}{n} \\sum_{i=1}^{n} x_{i}^2}',
      matrixMath: '\\text{RMS}(A) = \\sqrt{\\frac{1}{m \\cdot n} \\sum_{i,j} a_{ij}^2}',
    },
    L2: {
      // Standard L2 (Euclidean) norm for vector, and Frobenius norm for matrix (the standard generalization)
      vectorMath: '\\|x\\|_2 = \\sqrt{\\sum_{i=1}^{n} x_{i}^2}',
      matrixMath: '\\|A\\|_{F} = \\sqrt{\\sum_{i,j} a_{ij}^2}',
    },
    L1: {
      // Standard L1 (Manhattan) norm for both
      vectorMath: '\\|x\\|_1 = \\sum_{i=1}^{n} |x_{i}|',
      matrixMath: '\\|A\\|_1 = \\sum_{i,j} |a_{ij}|',
    },
  };

  const [configA, setConfigA] = useState({
    initType: 'xavier',
    mean: 0,
    std: 0, 
    constant: 0,
    scale: 1
  });

  const [configB, setConfigB] = useState({
    initType: 'xavier',
    mean: 0,
    std: 0, 
    constant: 0,
    scale: 1
  });

  const [matrices, setMatrices] = useState({
    A: [[]],
    B: [[]],
    C: [[]]
  });

  useEffect(() => {
    const { m, k, n } = dims;

    const A = generateMatrix(m, k, configA, { fanIn: k, fanOut: m });
    const B = generateMatrix(k, n, configB, { fanIn: k, fanOut: n });
    const C = matMul(A, B);

    setMatrices({ A, B, C });
  }, [
    dims.m,
    dims.k,
    dims.n,
    configA.initType,
    configA.mean,
    configA.std,
    configA.constant,
    configA.scale,
    configB.initType,
    configB.mean,
    configB.std,
    configB.constant,
    configB.scale
  ]);

  const normA = computeNorm(matrices.A, normType);
  const normB = computeNorm(matrices.B, normType);
  const normC = computeNorm(matrices.C, normType);

  const updateDims = (partial) => {
    setDims((prev) => ({
      m: clampDim(partial.m ?? prev.m),
      k: clampDim(partial.k ?? prev.k),
      n: clampDim(partial.n ?? prev.n)
    }));
  };

  const handleAResize = (rows, cols) => {
    updateDims({ m: rows, k: cols });
  };

  const handleBResize = (rows, cols) => {
    updateDims({ k: rows, n: cols });
  };

  const handleCResize = (rows, cols) => {
    updateDims({ m: rows, n: cols });
  };

  return (
    <div className="app">
      <header className="header">
        <h1>RMS Norm Visualizer</h1>
        <p className="subtitle">
          Explore how initialization and scaling affect activation norms in a simple
          matrix multiplication: <InlineMath math={`A: m \\times k \\cdot B: k \\times n \\rightarrow C: m \\times n`} />
        </p>
      </header>
      
      {/* --- NEW NORM CARDS SECTION --- */}
      <section className="norm-cards-section">
        <NormCard
          name="RMS"
          vectorMath={normDefinitions.RMS.vectorMath}
          matrixMath={normDefinitions.RMS.matrixMath}
          isSelected={normType === 'RMS'}
          onSelect={setNormType}
        />
        <NormCard
          name="L2"
          vectorMath={normDefinitions.L2.vectorMath}
          matrixMath={normDefinitions.L2.matrixMath}
          isSelected={normType === 'L2'}
          onSelect={setNormType}
        />
        <NormCard
          name="L1"
          vectorMath={normDefinitions.L1.vectorMath}
          matrixMath={normDefinitions.L1.matrixMath}
          isSelected={normType === 'L1'}
          onSelect={setNormType}
        />
      </section>
      {/* --- END NEW NORM CARDS SECTION --- */}
      
      <hr />

      <section className="controls-row">
        {/* The norm-toggle and equation sections are now handled by the NormCard components */}
        
        <div className="dim-inputs">
          <div className="dim-group">
            <label>
              A rows (<InlineMath math={'m'} />)
              <input
                type="number"
                min={MIN_DIM}
                max={MAX_DIM}
                value={dims.m}
                onChange={(e) => updateDims({ m: parseInt(e.target.value || '1', 10) })}
              />
            </label>
          </div>
          <div className="dim-group">
            <label>
              Shared dim (<InlineMath math={'k'} />)
              <input
                type="number"
                min={MIN_DIM}
                max={MAX_DIM}
                value={dims.k}
                onChange={(e) => updateDims({ k: parseInt(e.target.value || '1', 10) })}
              />
            </label>
          </div>
          <div className="dim-group">
            <label>
              B cols (<InlineMath math={'n'} />)
              <input
                type="number"
                min={MIN_DIM}
                max={MAX_DIM}
                value={dims.n}
                onChange={(e) => updateDims({ n: parseInt(e.target.value || '1', 10) })}
              />
            </label>
          </div>
          <div className="dim-hint">
            <InlineMath math={`A: m \\times k \\cdot B: k \\times n \\rightarrow C: m \\times n`} /> (always compatible)
          </div>
        </div>
      </section>

      <hr />

      <section className="matrices-section">
        <div className="matrix-panel">
          <div className="matrix-header">
            <div>
              <div className="matrix-name">Matrix <InlineMath math={'A'} /></div>
              <div className="matrix-shape">
                <InlineMath math={`${dims.m} \\times ${dims.k}`} />
              </div>
            </div>
            <div className="matrix-norm">
                <InlineMath math={`\\text{${normType} norm} \\approx`} /> <span>{normA.toFixed(4)}</span>
            </div>
          </div>

          <MatrixShape
            label="A"
            rows={dims.m}
            cols={dims.k}
            colorClass="matrix-a"
            onResize={handleAResize}
          />

          <InitControls
            title="Initialization for A"
            config={configA}
            onChange={setConfigA}
            fanInfo={{ fanIn: dims.k, fanOut: dims.m }}
          />
        </div>

        <div className="matrix-panel">
          <div className="matrix-header">
            <div>
              <div className="matrix-name">Matrix <InlineMath math={'B'} /></div>
              <div className="matrix-shape">
                <InlineMath math={`${dims.k} \\times ${dims.n}`} />
              </div>
            </div>
            <div className="matrix-norm">
              <InlineMath math={`\\text{${normType} norm} \\approx`} /> <span>{normB.toFixed(4)}</span>
            </div>
          </div>

          <MatrixShape
            label="B"
            rows={dims.k}
            cols={dims.n}
            colorClass="matrix-b"
            onResize={handleBResize}
          />

          <InitControls
            title="Initialization for B"
            config={configB}
            onChange={setConfigB}
            fanInfo={{ fanIn: dims.k, fanOut: dims.n }}
          />
        </div>

        <div className="matrix-panel">
          <div className="matrix-header">
            <div>
              <div className="matrix-name">Product <InlineMath math={'C = A \\cdot B'} /></div>
              <div className="matrix-shape">
                <InlineMath math={`${dims.m} \\times ${dims.n}`} />
              </div>
            </div>
            <div className="matrix-norm">
              <InlineMath math={`\\text{${normType} norm} \\approx`} /> <span>{normC.toFixed(4)}</span>
            </div>
          </div>

          <MatrixShape
            label="C"
            rows={dims.m}
            cols={dims.n}
            colorClass="matrix-c"
            onResize={handleCResize}
          />

          <div className="init-controls derived">
            <div className="init-title">Product Activations</div>
            <p className="derived-text">
              <InlineMath math={'C'} /> is computed as the matrix product <InlineMath math={'A \\cdot B'} />. Change <InlineMath math={'A'} />/<InlineMath math={'B'} /> dimensions, initialization, or scale to
              see how the norm of <InlineMath math={'C'} /> responds.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}