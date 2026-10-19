/**
 * Narrative content for the 17 equations. Prose fields accept inline math delimited by $…$
 * (rendered with KaTeX by <Rich/>). Historical claims are deliberately hedged where the
 * record is shared between several contributors.
 */
export interface SymbolDef {
  tex: string;
  name: string;
  desc: string;
}
export interface Challenge {
  id: string;
  prompt: string;
  hint: string;
  observe: string;
  /** Experience emits this goal id when the visitor achieves it; otherwise self-marked. */
  auto?: boolean;
}
export interface Connection {
  to: string;
  why: string;
}
export interface Equation {
  id: string;
  num: number;
  name: string;
  short: string;
  tex: string;
  texExtra?: string[];
  era: string;
  year: number; // approximate, for the timeline layout
  people: string;
  palette: { a: string; b: string; c: string };
  glyph: string; // small decorative SVG path id
  see: string;
  problem: string;
  history: string;
  breakthrough: string;
  plain: string;
  symbols: SymbolDef[];
  responds: string;
  applications: { title: string; body: string }[];
  impact: string;
  caveats: string;
  deeper: { title: string; body: string }[];
  connections: Connection[];
  challenges: Challenge[];
}

export const EQUATIONS: Equation[] = [
  {
    id: 'pythagoras',
    num: 1,
    name: 'Pythagorean Theorem',
    short: 'The geometry of distance',
    tex: 'a^2 + b^2 = c^2',
    era: 'c. 1800 BCE – 300 BCE',
    year: -530,
    people: 'Babylonian scribes, Indian Śulba-sūtra authors, the Pythagorean school, Euclid',
    palette: { a: '#ffc861', b: '#5ee7ff', c: '#ff7ab6' },
    glyph: 'triangle',
    see: 'Two squares dissolve into tiles that pour into the third — and fill it exactly.',
    problem:
      'How long is the diagonal of a field, the slope of a ramp, or the straight-line distance between two places? Builders and surveyors needed a reliable rule linking the sides of a right-angled triangle.',
    history:
      'Long before Pythagoras, Babylonian scribes recorded triples such as 3–4–5 (the tablet Plimpton 322, c. 1800 BCE), Indian Śulba-sūtras used the relation for altar construction, and Chinese texts discuss it. The theorem carries the name of Pythagoras (c. 570–495 BCE), though no proof by him survives. The oldest surviving general proof is Proposition 47 of Book I of Euclid’s *Elements* (c. 300 BCE).',
    breakthrough:
      'It turned a statement about **lengths** into a statement about **areas**, and it holds for every right triangle — not just convenient whole-number ones. That universality is what made it a theorem rather than a rule of thumb.',
    plain:
      'Draw a square on each side of a right-angled triangle. The two squares on the shorter sides together have exactly the same area as the square on the longest side (the hypotenuse).',
    symbols: [
      { tex: 'a,\\ b', name: 'legs', desc: 'The two sides that meet at the right angle.' },
      { tex: 'c', name: 'hypotenuse', desc: 'The side opposite the right angle — always the longest.' },
      { tex: 'a^2', name: 'area of a square', desc: 'A side length squared is literally the area of the square built on it.' },
    ],
    responds:
      'Drag the corners or use the sliders. The three squares, their areas and the hypotenuse update together; the right angle is preserved by construction.',
    applications: [
      { title: 'Distance in coordinates', body: 'The distance between $(x_1,y_1)$ and $(x_2,y_2)$ is $\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}$ — the theorem in disguise, extended to 3-D in every physics engine.' },
      { title: 'Navigation & positioning', body: 'Satellite positioning solves for a location from measured distances; each distance is computed with the 3-D Pythagorean formula (plus relativistic and atmospheric corrections).' },
      { title: 'Construction & surveying', body: 'The 3–4–5 rope trick is still used to lay out square corners on building sites.' },
    ],
    impact:
      'Pythagoras’ theorem is the seed of Euclidean distance, and therefore of geometry, trigonometry, coordinate graphics, surveying and much of physics. Its generalisations reach as far as the spacetime interval of relativity.',
    caveats:
      'The theorem is exact in flat (Euclidean) space. On a curved surface such as the Earth, large triangles break it — which is exactly how mathematicians detect curvature.',
    deeper: [
      { title: 'A proof by rearrangement', body: 'Place four copies of the triangle inside a square of side $a+b$. Arranged one way, they leave a tilted square hole of area $c^2$. Rearranged, they leave two holes of areas $a^2$ and $b^2$. The big square and the four triangles are unchanged, so $c^2 = a^2 + b^2$. Use the **Proof** view to watch it.' },
      { title: 'The converse', body: 'If $a^2+b^2=c^2$ for a triangle’s sides then the angle opposite $c$ is a right angle (Euclid I.48). More generally the law of cosines $c^2=a^2+b^2-2ab\\cos C$ reduces to Pythagoras when $C=90^\\circ$.' },
      { title: 'In higher dimensions', body: 'In $n$ dimensions the length of a vector is $\\sqrt{x_1^2+\\cdots+x_n^2}$. In Fourier analysis, Parseval’s theorem is the same idea in infinitely many dimensions.' },
    ],
    connections: [
      { to: 'complex', why: 'The size of a complex number $a+bi$ is $\\sqrt{a^2+b^2}$ — Pythagoras on the complex plane.' },
      { to: 'relativity', why: 'Energy, momentum and mass obey $E^2=(pc)^2+(mc^2)^2$, a Pythagorean relation in spacetime.' },
      { to: 'fourier', why: 'Parseval’s theorem: a signal’s energy equals the sum of the squared sizes of its frequency components.' },
      { to: 'normal', why: 'Independent errors add “in quadrature”: $\\sigma^2=\\sigma_1^2+\\sigma_2^2$.' },
    ],
    challenges: [
      { id: 'p-345', prompt: 'Build the classic 3–4–5 triangle.', hint: 'Set a = 3 and b = 4.', observe: 'c lands exactly on 5: 9 + 16 = 25.', auto: true },
      { id: 'p-triple', prompt: 'Find a different whole-number triple.', hint: 'Try a = 5, or multiply 3–4–5 by 2.', observe: '5–12–13 and 8–15–17 are triples; so is any multiple of one.', auto: true },
      { id: 'p-iso', prompt: 'Make the two legs equal. How does c compare with a?', hint: 'Set a = b.', observe: 'c = a√2 ≈ 1.414a: the diagonal of a square is irrational.', auto: true },
      { id: 'p-flow', prompt: 'Watch the area tiles flow. Do they overflow or leave gaps?', hint: 'Choose the “Area flow” view.', observe: 'Every tile from a² and b² finds a place in c²; none are left over.', auto: true },
    ],
  },
  {
    id: 'logarithms',
    num: 2,
    name: 'Logarithms',
    short: 'Turning multiplication into addition',
    tex: '\\log(ab) = \\log a + \\log b',
    era: '1614',
    year: 1614,
    people: 'John Napier, Jost Bürgi, Henry Briggs, Edmund Gunter, William Oughtred',
    palette: { a: '#57f2c7', b: '#7c9cff', c: '#d7ff7a' },
    glyph: 'log',
    see: 'Watch a number line bend: equal ratios become equal steps, and a product becomes a sum of lengths.',
    problem:
      'Astronomers and navigators of the early 1600s spent days multiplying long numbers by hand, and every slip corrupted a table. Was there a way to replace multiplication with something easier?',
    history:
      'John Napier published his *Mirifici Logarithmorum Canonis Descriptio* in 1614; Jost Bürgi had independently built similar tables (published 1620). Henry Briggs reworked them into base-10 logarithms. Edmund Gunter drew logarithms as a ruler scale (c. 1620) and William Oughtred slid two such scales together — the slide rule, which engineers used for over three centuries. Kepler used logarithms when completing his Rudolphine Tables (1627).',
    breakthrough:
      'A logarithm measures *how many times you multiply* the base to reach a number. Because multiplying numbers adds those counts, the hard operation becomes the easy one.',
    plain:
      'The logarithm of a number tells you its “size in steps of the base”. Multiplying two numbers adds their step counts. So with a table (or a ruler marked logarithmically) you can multiply by adding.',
    symbols: [
      { tex: '\\log_b x', name: 'logarithm base b', desc: 'The power you raise b to in order to get x: $b^{\\log_b x}=x$.' },
      { tex: 'a,\\ b', name: 'positive numbers', desc: 'Logarithms of zero and negative numbers are undefined for real arithmetic.' },
      { tex: 'b', name: 'base', desc: 'Any positive base ≠ 1 works; 10, 2 and e ≈ 2.718 are common. The same base must be used throughout.' },
    ],
    responds:
      'Pick a and b; their positions on the logarithmic ruler are lengths that add to the position of ab. Changing the base rescales every length equally, so the identity survives.',
    applications: [
      { title: 'Measuring huge ranges', body: 'Decibels, the pH scale, earthquake magnitudes and stellar magnitudes are all logarithmic: each step is a fixed multiple.' },
      { title: 'Slide rules to scientific computing', body: 'Slide rules computed by adding logarithmic lengths. Today, logs keep tiny probabilities from underflowing in statistics and machine learning (“log-likelihood”).' },
      { title: 'Growth and decay', body: 'Doubling times, half-lives and compound interest are solved with logarithms: $t = \\ln 2 / k$.' },
    ],
    impact:
      'For more than three centuries, logarithm tables and slide rules were the computing engines behind astronomy, navigation, engineering and science. The logarithmic way of thinking — in orders of magnitude — remains essential.',
    caveats:
      'The identity needs $a,b>0$ and one consistent base. Logarithmic plots compress large values, which can hide detail as easily as reveal it.',
    deeper: [
      { title: 'Why it works', body: 'If $a=b^m$ and $c=b^n$ then $ac=b^{m+n}$, so $\\log_b(ac)=m+n=\\log_b a+\\log_b c$. Logarithms convert the multiplicative structure of positive numbers into the additive structure of the real line.' },
      { title: 'Change of base', body: '$\\log_b x = \\dfrac{\\ln x}{\\ln b}$. Every logarithm is the natural logarithm rescaled — which is why changing base stretches the ruler uniformly.' },
      { title: 'The natural logarithm', body: '$\\ln x = \\int_1^x \\frac{dt}{t}$: the area under $1/t$. Its derivative $1/x$ makes it central to calculus.' },
    ],
    connections: [
      { to: 'shannon', why: 'Information is measured with $\\log_2$: independent events multiply probabilities and add bits.' },
      { to: 'thermodynamics', why: 'Boltzmann’s entropy $S=k_B\\ln\\Omega$ is a logarithm of the number of microstates.' },
      { to: 'calculus', why: '$\\tfrac{d}{dx}\\ln x = 1/x$, and $e^x$ is its own derivative.' },
      { to: 'black-scholes', why: 'Prices are modelled with normally distributed log-returns.' },
    ],
    challenges: [
      { id: 'log-product', prompt: 'Multiply 8 × 16 using only addition of lengths.', hint: 'Set a = 8 and b = 16; read off where the two lengths end.', observe: 'log 8 + log 16 lands exactly at log 128.', auto: true },
      { id: 'log-base', prompt: 'Switch to base 2. Does the identity still hold?', hint: 'Use the base selector.', observe: 'Every length scales by the same factor, so the sum still matches.', auto: true },
      { id: 'log-slide', prompt: 'Use the slide rule to compute a product.', hint: 'Choose the “Slide rule” view.', observe: 'Sliding one scale by log a turns reading b into reading ab.', auto: true },
      { id: 'log-span', prompt: 'Explore the cosmic ruler from atom to universe.', hint: 'Choose the “Orders of magnitude” view.', observe: 'Thirty-six orders of magnitude fit on one screen.', auto: true },
    ],
  },
  {
    id: 'calculus',
    num: 3,
    name: 'Calculus',
    short: 'The mathematics of change',
    tex: '\\frac{dy}{dx} = \\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}',
    texExtra: ['\\int_a^b f(x)\\,dx = F(b) - F(a)'],
    era: '1665 – 1690s',
    year: 1675,
    people: 'Isaac Newton, Gottfried Wilhelm Leibniz; precursors Archimedes, Fermat, Barrow; foundations by Cauchy & Weierstrass',
    palette: { a: '#4fe3ff', b: '#ff5fd2', c: '#f8f871' },
    glyph: 'curve',
    see: 'A tangent line rides the curve, turning to match its slope, while light pours into the area beneath.',
    problem:
      'How do you describe a quantity that changes continuously — the speed of a falling body at one instant, or the total distance covered when speed keeps varying?',
    history:
      'Archimedes computed areas by exhaustion; Fermat and Barrow found tangents. Isaac Newton developed his “method of fluxions” around 1665–66 (published much later), and Gottfried Leibniz published his differential calculus in 1684 with the notation $dy/dx$ and $\\int$ we still use. A bitter priority dispute followed; both are now credited with independent invention. Rigorous foundations using limits came in the 19th century with Cauchy and Weierstrass.',
    breakthrough:
      'Two problems — finding slopes (derivatives) and finding areas (integrals) — turned out to be inverses of each other. This **Fundamental Theorem of Calculus** made both routine.',
    plain:
      'The derivative is the slope of a curve at a single point: zoom in far enough and the curve looks like a straight line. The integral adds up infinitely many thin slices to get an area. Each undoes the other.',
    symbols: [
      { tex: '\\frac{dy}{dx}', name: 'derivative', desc: 'Instantaneous rate of change: how fast y changes per unit change in x.' },
      { tex: 'h', name: 'step size', desc: 'The gap used in the average rate of change. The derivative is the limit as h → 0.' },
      { tex: '\\int_a^b f\\,dx', name: 'definite integral', desc: 'Signed area between the curve and the x-axis from a to b (area below the axis counts as negative).' },
      { tex: 'F', name: 'antiderivative', desc: 'Any function whose derivative is f.' },
    ],
    responds:
      'Drag the point to move the tangent; shrink h to watch the secant line converge on it. Increase the number of rectangles and the Riemann sum approaches the exact integral.',
    applications: [
      { title: 'Physics', body: 'Velocity is the derivative of position; acceleration the derivative of velocity. Newton’s laws are differential equations.' },
      { title: 'Engineering & optimisation', body: 'Setting a derivative to zero finds maxima and minima: strongest beams, cheapest designs, best fits.' },
      { title: 'Machine learning', body: 'Neural networks are trained by gradient descent — repeatedly stepping against the derivative of an error function.' },
    ],
    impact:
      'Calculus is the language of nearly every equation that follows in this collection: gravity, waves, fluids, electromagnetism, quantum mechanics and option pricing are all written with derivatives and integrals.',
    caveats:
      'Not every function has a derivative everywhere (think of a sharp corner), and numerical derivatives become noisy if h is made too small on a computer.',
    deeper: [
      { title: 'The fundamental theorem', body: 'If $F(x)=\\int_a^x f(t)\\,dt$ then $F\'(x)=f(x)$. The lower plot shows $F$ growing; its slope at every point equals the height of $f$.' },
      { title: 'Riemann sums', body: 'With $n$ rectangles of width $\\Delta x=(b-a)/n$, $\\sum f(x_i^*)\\Delta x \\to \\int_a^b f\\,dx$. Left/right sums have error $O(1/n)$; midpoint and trapezoid rules $O(1/n^2)$.' },
      { title: 'Exact values here', body: 'For preset functions the exact integral uses the known antiderivative; for drawn or bell-shaped curves it uses Simpson’s rule with thousands of panels (error far below what is displayed).' },
    ],
    connections: [
      { to: 'gravity', why: 'Newton invented calculus partly to derive planetary orbits from the inverse-square law.' },
      { to: 'wave', why: 'The wave equation relates second derivatives in time and space.' },
      { to: 'navier-stokes', why: 'Fluid flow is described by partial differential equations.' },
      { to: 'normal', why: 'Probabilities of continuous variables are integrals of a density.' },
    ],
    challenges: [
      { id: 'calc-h', prompt: 'Shrink h towards 0. What happens to the secant?', hint: 'Turn on the secant and drag h below 0.01.', observe: 'The secant line rotates into the tangent; average rate → instantaneous rate.', auto: true },
      { id: 'calc-zero', prompt: 'Find a point where the slope is zero.', hint: 'Look at the top of a hill or bottom of a valley.', observe: 'At a peak or trough the tangent is horizontal: f′(x) = 0.', auto: true },
      { id: 'calc-riemann', prompt: 'Use at least 100 rectangles. How close is the sum?', hint: 'Drag the rectangle count up.', observe: 'The error shrinks as n grows — the integral is the limit.', auto: true },
      { id: 'calc-draw', prompt: 'Draw your own function and differentiate it.', hint: 'Choose “Draw” and sketch across the plot.', observe: 'Every smooth curve you draw has a slope at each point.', auto: true },
    ],
  },
  {
    id: 'gravity',
    num: 4,
    name: 'Universal Gravitation',
    short: 'One law for apples and planets',
    tex: 'F = G\\,\\frac{m_1 m_2}{r^2}',
    era: '1687',
    year: 1687,
    people: 'Isaac Newton; with ideas from Robert Hooke, Kepler’s laws, and Cavendish’s 1798 experiment',
    palette: { a: '#ffb057', b: '#6aa8ff', c: '#ffe7c2' },
    glyph: 'orbit',
    see: 'Two bodies pull on each other with equal and opposite force, carving orbits through the dark.',
    problem:
      'Kepler showed that planets move on ellipses, but why? And is the force that makes an apple fall the same one that holds the Moon in orbit?',
    history:
      'Newton’s *Philosophiæ Naturalis Principia Mathematica* (1687) showed that an inverse-square attraction explains Kepler’s three laws, the tides and the motion of comets. Robert Hooke and others had suggested an inverse-square law; Newton supplied the mathematics. The constant G was first effectively measured in Henry Cavendish’s torsion-balance experiment of 1798.',
    breakthrough:
      '**Universality**: the same simple law governs falling apples, the Moon, the planets and (later we learned) galaxies. The heavens and the Earth obey one physics.',
    plain:
      'Every two masses attract each other. Double either mass and the pull doubles. Double the distance and the pull drops to one quarter.',
    symbols: [
      { tex: 'F', name: 'force', desc: 'Strength of the attraction, in newtons. Both bodies feel the same size of force, in opposite directions.' },
      { tex: 'G', name: 'gravitational constant', desc: '$6.674\\times10^{-11}\\ \\mathrm{N\\,m^2\\,kg^{-2}}$ — tiny, which is why gravity between everyday objects is imperceptible.' },
      { tex: 'm_1,\\ m_2', name: 'masses', desc: 'Measured in kilograms (shown here in solar or Earth masses).' },
      { tex: 'r', name: 'separation', desc: 'Distance between the centres of mass.' },
    ],
    responds:
      'Change the masses or separation and the force readout follows $F\\propto m_1m_2/r^2$ at once. Launch an orbit and a symplectic integrator moves both bodies under their mutual pull.',
    applications: [
      { title: 'Spaceflight', body: 'Trajectories to the Moon and planets, including gravity-assist slingshots, are planned with Newtonian gravity plus small corrections.' },
      { title: 'Discovering worlds', body: 'In 1846 Neptune was found where Le Verrier predicted from irregularities in Uranus’ orbit. Exoplanets are detected by the wobble they induce in their stars.' },
      { title: 'Tides & geodesy', body: 'Tides follow from differences in the Moon’s and Sun’s pull across the Earth; satellites map Earth’s gravity field to monitor ice and groundwater.' },
    ],
    impact:
      'Newtonian gravity founded celestial mechanics and showed that nature follows mathematical laws that can predict the future — a template for all of modern physics.',
    caveats:
      'Newton’s law is an excellent approximation for weak fields and slow speeds. Einstein’s general relativity (1915) replaces it: it explains Mercury’s perihelion drift, gravitational lensing and the clock corrections needed by satellite navigation. This simulation is purely Newtonian.',
    deeper: [
      { title: 'Units in the simulation', body: 'Distances are in astronomical units, time in years, masses in solar masses, so $G=4\\pi^2$. An Earth-mass planet at 1 AU from one solar mass orbits in exactly one year.' },
      { title: 'Why ellipses need 1/r²', body: 'Bertrand’s theorem: among power-law central forces, only $1/r^2$ and the spring law $r$ produce closed orbits for all bound initial conditions. Try exponent 2.5 or 3 to see orbits precess or spiral.' },
      { title: 'Energy and escape', body: 'The relative orbit has specific energy $\\varepsilon=\\tfrac12v^2-GM/r$. If $\\varepsilon<0$ the orbit is bound (ellipse); $\\varepsilon\\ge 0$ means escape. Circular speed is $\\sqrt{GM/r}$, escape speed $\\sqrt{2GM/r}$.' },
    ],
    connections: [
      { to: 'calculus', why: 'Newton needed calculus to turn the force law into orbits.' },
      { to: 'relativity', why: 'Einstein’s relativity revised Newtonian gravity and mechanics.' },
      { to: 'maxwell', why: 'Coulomb’s electric force is also an inverse-square law.' },
      { to: 'chaos', why: 'Three or more gravitating bodies can move chaotically, as Poincaré discovered.' },
    ],
    challenges: [
      { id: 'grav-double', prompt: 'Double the separation. What happens to the force?', hint: 'Watch the force readout as you change r.', observe: 'The force falls to one quarter: inverse-square.', auto: true },
      { id: 'grav-circle', prompt: 'Launch a nearly circular orbit.', hint: 'Set launch speed to 1.00 × circular.', observe: 'Eccentricity ≈ 0, and the period matches Kepler’s third law.', auto: true },
      { id: 'grav-escape', prompt: 'Give the bodies enough speed to escape.', hint: 'Push launch speed above √2 ≈ 1.414 × circular.', observe: 'Total energy becomes positive; the bodies never return.', auto: true },
      { id: 'grav-law', prompt: 'Change the force law to 1/r³ or 1/r^2.5.', hint: 'Use the “distance exponent” slider.', observe: 'Orbits no longer close: they precess into rosettes or spiral away.', auto: true },
    ],
  },
  {
    id: 'complex',
    num: 5,
    name: 'The Square Root of Minus One',
    short: 'A new dimension for numbers',
    tex: 'i^2 = -1',
    texExtra: ['e^{i\\pi} + 1 = 0'],
    era: '1545 – 1806',
    year: 1572,
    people: 'Gerolamo Cardano, Rafael Bombelli, Leonhard Euler, Caspar Wessel, Jean-Robert Argand, Carl Friedrich Gauss',
    palette: { a: '#b48cff', b: '#ff6fb5', c: '#6ff7ff' },
    glyph: 'spiral',
    see: 'Multiplying by i is a quarter-turn. Do it four times and you are home again.',
    problem:
      'Formulas for solving cubic equations sometimes required square roots of negative numbers — even when the final answers were ordinary real numbers. Were these “impossible” quantities meaningful?',
    history:
      'Cardano met them in *Ars Magna* (1545) and called them useless; Rafael Bombelli (1572) laid down rules for calculating with them. Euler introduced the symbol $i$ (1777) and discovered $e^{i\\theta}=\\cos\\theta+i\\sin\\theta$. Wessel (1799), Argand (1806) and Gauss gave the geometric picture: complex numbers are points of a plane.',
    breakthrough:
      'Once numbers live on a plane rather than a line, **multiplication becomes rotation and scaling**. Multiplying by $i$ rotates by 90°, so $i\\cdot i$ points the opposite way to 1: $-1$.',
    plain:
      'Think of the number line as one direction. Imaginary numbers add a second, perpendicular direction. Multiplying by $i$ turns any number a quarter-turn anticlockwise — twice turns you around to the negative numbers.',
    symbols: [
      { tex: 'i', name: 'imaginary unit', desc: 'A number with $i^2=-1$. It sits one unit up the vertical axis.' },
      { tex: 'z = a+bi', name: 'complex number', desc: 'Real part $a$ (horizontal) and imaginary part $b$ (vertical).' },
      { tex: '|z|,\\ \\arg z', name: 'modulus & argument', desc: 'Distance from 0 and angle from the positive real axis.' },
      { tex: 'e^{i\\theta}', name: 'unit phasor', desc: 'The point at angle θ on the unit circle: $\\cos\\theta+i\\sin\\theta$.' },
    ],
    responds:
      'Drag z and w around the plane. Their product’s length is the product of lengths and its angle is the sum of angles — watch the readouts match.',
    applications: [
      { title: 'Alternating current', body: 'Engineers represent voltages and currents as rotating phasors; impedance $Z=R+iX$ turns circuit differential equations into algebra.' },
      { title: 'Signal processing', body: 'The Fourier transform uses $e^{-i\\omega t}$ to measure each frequency’s amplitude and phase at once.' },
      { title: 'Quantum mechanics', body: 'Wavefunctions are complex-valued; interference comes from adding phases.' },
    ],
    impact:
      'Complex numbers made algebra complete (every polynomial has roots — the fundamental theorem of algebra) and became the natural language of oscillations, waves, electrical engineering and quantum physics.',
    caveats:
      '“Imaginary” is a historical label, not a judgement: complex numbers are as rigorously defined as real ones. They cannot be ordered by size the way real numbers can.',
    deeper: [
      { title: 'Euler’s identity', body: 'From the power series $e^{z}=\\sum z^n/n!$, substituting $z=i\\theta$ separates into the series for cos and sin. At $\\theta=\\pi$: $e^{i\\pi}=-1$. The spiral view plots the partial sums homing in on −1.' },
      { title: 'Multiplication in polar form', body: '$r_1e^{i\\theta_1}\\cdot r_2e^{i\\theta_2}=r_1r_2\\,e^{i(\\theta_1+\\theta_2)}$. Lengths multiply, angles add.' },
      { title: 'Phasors', body: 'A rotating vector $Ae^{i(\\omega t+\\varphi)}$ has real part $A\\cos(\\omega t+\\varphi)$. Sinusoids are shadows of circular motion.' },
    ],
    connections: [
      { to: 'fourier', why: 'Every frequency component is a rotating complex phasor.' },
      { to: 'schrodinger', why: 'The $i$ in $i\\hbar\\,\\partial\\psi/\\partial t$ makes quantum states rotate in phase.' },
      { to: 'pythagoras', why: '$|a+bi|=\\sqrt{a^2+b^2}$.' },
      { to: 'maxwell', why: 'AC circuits and electromagnetic waves are analysed with complex phasors.' },
    ],
    challenges: [
      { id: 'cx-i4', prompt: 'Multiply by i four times.', hint: 'Press “× i” repeatedly.', observe: 'Each press rotates 90°; after four you are back where you started: i⁴ = 1.', auto: true },
      { id: 'cx-euler', prompt: 'Set θ = π. Where is e^{iθ}?', hint: 'Use the Euler view and the θ slider (or the “θ = π” button).', observe: 'Exactly at −1: e^{iπ} + 1 = 0.', auto: true },
      { id: 'cx-mult', prompt: 'Multiply z and w. Check that angles add.', hint: 'Use the “z × w” view and drag both points.', observe: 'arg(zw) = arg z + arg w and |zw| = |z||w|.', auto: true },
    ],
  },
  {
    id: 'euler-polyhedra',
    num: 6,
    name: 'Euler’s Formula for Polyhedra',
    short: 'The birth of topology',
    tex: 'V - E + F = 2',
    era: '1750 – 1752',
    year: 1750,
    people: 'Leonhard Euler; anticipated in part by René Descartes; proofs by Legendre and Cauchy',
    palette: { a: '#e8f4ff', b: '#9dff6a', c: '#6ab7ff' },
    glyph: 'cube',
    see: 'Vertices ignite, edges draw themselves between them, and faces light up one by one. Count them.',
    problem:
      'Is there a rule connecting the numbers of corners, edges and faces of solid shapes — something deeper than any particular geometry of lengths and angles?',
    history:
      'Euler announced the formula in a 1750 letter to Christian Goldbach and published proofs in 1752 (his own proof had a gap). Descartes had found a closely related result about angles around 1630, unpublished in his lifetime. Legendre gave a rigorous proof in 1794. Counterexamples — solids with holes — led Lhuilier, Poincaré and others to the idea of a topological invariant.',
    breakthrough:
      'The number $V-E+F$ does not care about lengths, angles or even straightness — only about how the pieces connect. That is a **topological** property, and recognising such properties founded a new branch of mathematics.',
    plain:
      'Take any solid shape without holes, like a cube or a pyramid. Count its corners (V), edges (E) and flat faces (F). Corners minus edges plus faces always comes out to 2.',
    symbols: [
      { tex: 'V', name: 'vertices', desc: 'Corner points.' },
      { tex: 'E', name: 'edges', desc: 'Line segments where two faces meet.' },
      { tex: 'F', name: 'faces', desc: 'Flat polygonal pieces of surface.' },
      { tex: '\\chi', name: 'Euler characteristic', desc: '$\\chi=V-E+F$. It is 2 for any surface that can be deformed into a sphere and $2-2g$ for a surface with $g$ holes.' },
    ],
    responds:
      'Switch solids, then perform surgery — poke a face, split an edge, slice off a corner. V, E and F change, but V − E + F stays fixed. The torus shows the exception.',
    applications: [
      { title: 'Computer graphics', body: 'Mesh-processing software checks Euler’s formula to detect holes and errors in 3-D models.' },
      { title: 'Networks & maps', body: 'For planar networks $V-E+F=2$ limits how densely things can connect, which underlies results like the Five Colour Theorem.' },
      { title: 'Physics & biology', body: 'Topological invariants classify phases of matter (2016 Nobel Prize in Physics) and constrain shapes such as viral capsids and fullerenes: every closed cage of hexagons and pentagons with three edges at each corner (like a football or C₆₀) has exactly 12 pentagons.' },
    ],
    impact:
      'Euler’s formula is the first topological invariant. Topology now underpins analysis, robotics path-planning, data science (topological data analysis), materials physics and cosmology.',
    caveats:
      'The value 2 holds for convex polyhedra and any polyhedron topologically equivalent to a sphere. Surfaces with holes give different values (0 for a torus), and non-manifold shapes need more care.',
    deeper: [
      { title: 'Why surgery preserves χ', body: 'Poking a k-gon: $\\Delta V=+1, \\Delta E=+k, \\Delta F=k-1$. Splitting an edge: $+1,+1,0$. Cutting a face with a diagonal: $0,+1,+1$. Each change sums to 0 in $V-E+F$.' },
      { title: 'A proof sketch', body: 'Remove one face and flatten the rest onto a plane, giving a planar network with $V-E+F=1$. Triangulate faces and remove boundary triangles one at a time; each removal keeps $V-E+F$ unchanged until a single triangle ($3-3+1=1$) remains. Add back the missing face: 2.' },
      { title: 'Genus', body: 'For a closed orientable surface with $g$ handles, $\\chi=2-2g$. The polyhedral torus here has $V=32,E=64,F=32$: $\\chi=0$, so $g=1$.' },
    ],
    connections: [
      { to: 'pythagoras', why: 'Both began in Greek-style solid geometry; Euler showed some truths need no measurement at all.' },
      { to: 'complex', why: 'Riemann classified complex surfaces by their genus — the same invariant.' },
      { to: 'schrodinger', why: 'Topological invariants classify exotic quantum phases of matter.' },
    ],
    challenges: [
      { id: 'eu-ico', prompt: 'Count V, E and F for the icosahedron.', hint: 'Select the icosahedron.', observe: '12 − 30 + 20 = 2.', auto: true },
      { id: 'eu-surgery', prompt: 'Perform three surgeries. Does V − E + F change?', hint: 'Use Poke, Split edge or Truncate.', observe: 'V, E and F all change, but χ stays 2.', auto: true },
      { id: 'eu-torus', prompt: 'Load the torus. What is V − E + F now?', hint: 'Choose “Torus (genus 1)”.', observe: '32 − 64 + 32 = 0: a hole changes the invariant.', auto: true },
    ],
  },
  {
    id: 'normal',
    num: 7,
    name: 'The Normal Distribution',
    short: 'The shape of randomness',
    tex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}}\\,e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}',
    era: '1733 – 1810',
    year: 1780,
    people: 'Abraham de Moivre, Pierre-Simon Laplace, Carl Friedrich Gauss, Adolphe Quetelet, Francis Galton',
    palette: { a: '#ff8f7a', b: '#ffd36e', c: '#7ad8ff' },
    glyph: 'bell',
    see: 'Thousands of random points rain down and, without any plan, pile up into a bell.',
    problem:
      'Repeated measurements of the same star never agree exactly. How should scientists combine noisy observations, and how likely is an error of a given size?',
    history:
      'Abraham de Moivre found the bell curve in 1733 as an approximation to coin-tossing probabilities. Gauss (1809) used it to justify least squares in astronomy, and Laplace proved an early central limit theorem (1810), explaining why it appears so widely. Quetelet and Galton later applied it — sometimes too eagerly — to human traits.',
    breakthrough:
      'The **central limit theorem**: adding up many small independent effects produces a normal distribution almost regardless of what the individual effects look like. That is why the bell curve is everywhere.',
    plain:
      'Most values cluster around the average μ, and values far from it become rapidly rarer. The width σ (standard deviation) sets the spread: about 68% of values fall within one σ of the mean.',
    symbols: [
      { tex: '\\mu', name: 'mean', desc: 'The centre and peak of the distribution.' },
      { tex: '\\sigma', name: 'standard deviation', desc: 'The spread. Doubling σ doubles the width and halves the peak height.' },
      { tex: 'f(x)', name: 'probability density', desc: 'Probability *per unit of x*, not a probability. $P(a\\le X\\le b)=\\int_a^b f(x)dx$; any single exact value has probability 0.' },
      { tex: '\\frac{1}{\\sigma\\sqrt{2\\pi}}', name: 'normalising constant', desc: 'Makes the total area exactly 1.' },
    ],
    responds:
      'Change μ and σ and the curve shifts and stretches; samples drawn with the Box–Muller method fill a histogram that converges to it. Drag the interval handles to compute probabilities.',
    applications: [
      { title: 'Measurement & science', body: 'Error bars, confidence intervals and many hypothesis tests rest on (approximately) normal errors.' },
      { title: 'Quality control', body: 'Manufacturers track how many σ a process sits from its tolerance limits.' },
      { title: 'Machine learning & finance', body: 'Gaussian noise models, Kalman filters and the Black–Scholes model of log-returns all assume normal variation.' },
    ],
    impact:
      'The normal distribution made it possible to quantify uncertainty itself — the foundation of modern statistics, experimental science, polling, insurance and engineering tolerances.',
    caveats:
      'Real data are often not normal: incomes, earthquakes and market crashes have “fat tails” where extreme events are far more common than a bell curve predicts. Assuming normality there can be dangerous.',
    deeper: [
      { title: 'Box–Muller sampling', body: 'If $U_1,U_2$ are uniform on (0,1) then $Z=\\sqrt{-2\\ln U_1}\\cos(2\\pi U_2)$ is exactly standard normal. Samples are $X=\\mu+\\sigma Z$.' },
      { title: 'Interval probability', body: '$P(a\\le X\\le b)=\\Phi\\big(\\tfrac{b-\\mu}{\\sigma}\\big)-\\Phi\\big(\\tfrac{a-\\mu}{\\sigma}\\big)$ with $\\Phi(z)=\\tfrac12\\operatorname{erfc}(-z/\\sqrt2)$, evaluated here to about 7 significant figures.' },
      { title: 'Central limit theorem', body: 'The “sum of dice” source adds $k$ uniform dice. As $k$ grows, the standardised sum approaches $N(0,1)$ — try $k=1,2,3,12$.' },
    ],
    connections: [
      { to: 'black-scholes', why: 'Black–Scholes models log-returns as normally distributed; $N(d_1)$ appears in the price.' },
      { to: 'thermodynamics', why: 'Each velocity component of a gas molecule is normally distributed (Maxwell–Boltzmann).' },
      { to: 'fourier', why: 'The Fourier transform of a Gaussian is another Gaussian.' },
      { to: 'shannon', why: 'For a fixed variance, the normal distribution has the largest possible entropy.' },
    ],
    challenges: [
      { id: 'n-10k', prompt: 'Draw at least 10,000 samples.', hint: 'Press “+1 000” or “+10 000”.', observe: 'The histogram hugs the theoretical curve ever more closely.', auto: true },
      { id: 'n-2s', prompt: 'Highlight μ ± 2σ. What fraction lies inside?', hint: 'Press “±2σ”.', observe: '≈ 95.45% of the area; empirically very close.', auto: true },
      { id: 'n-clt', prompt: 'Switch to the sum-of-dice source with k ≥ 3.', hint: 'Use the source selector.', observe: 'Even sums of flat, uniform dice become bell-shaped: the central limit theorem.', auto: true },
    ],
  },
  {
    id: 'wave',
    num: 8,
    name: 'The Wave Equation',
    short: 'How disturbances travel',
    tex: '\\frac{\\partial^2 u}{\\partial t^2} = c^2\\,\\nabla^2 u',
    era: '1746',
    year: 1746,
    people: 'Jean le Rond d’Alembert; Leonhard Euler, Daniel Bernoulli, Joseph-Louis Lagrange',
    palette: { a: '#4cc9ff', b: '#7a5cff', c: '#b6fff0' },
    glyph: 'wave',
    see: 'Touch the membrane. A ring of disturbance races outward, reflects, and interferes with itself.',
    problem:
      'Why does a plucked string vibrate at particular pitches, and how does a disturbance travel through a medium without the medium itself flowing away?',
    history:
      'Jean le Rond d’Alembert derived and solved the one-dimensional wave equation for a vibrating string in 1746. Euler and Daniel Bernoulli argued over whether every vibration is a sum of simple modes — a debate settled only after Fourier’s work. The equation was extended to membranes, sound and, through Maxwell, light.',
    breakthrough:
      'The acceleration of each point depends on the **curvature** of the shape around it. That simple local rule creates waves travelling at a fixed speed $c$ in every direction.',
    plain:
      'Imagine a stretched sheet. Wherever it is bent, tension pulls it back towards flat, overshooting and bouncing. The equation says: acceleration equals wave-speed squared times bendiness.',
    symbols: [
      { tex: 'u(\\mathbf{x},t)', name: 'displacement', desc: 'How far the medium is displaced from rest at each point and time.' },
      { tex: '\\frac{\\partial^2 u}{\\partial t^2}', name: 'acceleration', desc: 'Second time-derivative of displacement.' },
      { tex: '\\nabla^2 u', name: 'Laplacian', desc: 'Measures how much u differs from the average of its surroundings — its curvature.' },
      { tex: 'c', name: 'wave speed', desc: 'Set by the medium (e.g. $\\sqrt{T/\\mu}$ for a string). Changing it changes how fast every disturbance travels.' },
    ],
    responds:
      'Click to drop a pulse or drive an oscillating source. Change c, frequency, damping and boundaries; the finite-difference solver updates the whole surface each frame.',
    applications: [
      { title: 'Music & acoustics', body: 'Instrument pitches are the standing-wave modes of strings, membranes and air columns; concert halls are designed with wave models.' },
      { title: 'Seismology', body: 'Earthquake waves reveal the Earth’s interior and are used to locate quakes and explore for resources.' },
      { title: 'Light & radio', body: 'Maxwell’s equations imply that electromagnetic fields obey a wave equation travelling at the speed of light.' },
    ],
    impact:
      'The wave equation unified sound, vibration, and later light and radio under one mathematical description, and inspired Fourier’s decomposition of signals into frequencies.',
    caveats:
      'This is the linear, non-dispersive wave equation. Water waves, sound in complex media, quantum waves and large-amplitude waves follow different (often nonlinear or dispersive) equations.',
    deeper: [
      { title: 'The numerical scheme', body: 'Leapfrog finite differences: $u^{n+1}_{ij}=2u^n_{ij}-u^{n-1}_{ij}+C^2(\\nabla_h^2u^n)_{ij}$ with Courant number $C=c\\,\\Delta t/\\Delta x\\le1/\\sqrt2$ in 2-D for stability. The time step is chosen automatically.' },
      { title: 'd’Alembert’s solution', body: 'In 1-D every solution is $u=f(x-ct)+g(x+ct)$: two shapes sliding in opposite directions without changing form.' },
      { title: 'Standing waves', body: 'On a string of length $L$ with fixed ends, the modes are $\\sin(n\\pi x/L)\\cos(n\\pi ct/L)$ with frequencies $f_n=nc/2L$ — the harmonic series.' },
    ],
    connections: [
      { to: 'fourier', why: 'Any vibration is a sum of standing-wave modes — Fourier analysis.' },
      { to: 'maxwell', why: 'Light is an electromagnetic wave obeying this equation with $c=1/\\sqrt{\\mu_0\\varepsilon_0}$.' },
      { to: 'schrodinger', why: 'Quantum particles obey a different, complex-valued wave equation.' },
      { to: 'calculus', why: 'A partial differential equation linking second derivatives.' },
    ],
    challenges: [
      { id: 'w-standing', prompt: 'Make a standing wave on the string.', hint: 'In 1-D mode press a harmonic button.', observe: 'Nodes stay still while antinodes oscillate.', auto: true },
      { id: 'w-interf', prompt: 'Create interference from two sources.', hint: 'Choose the “Two sources” preset.', observe: 'Bright and dark bands appear where waves add or cancel.', auto: true },
      { id: 'w-absorb', prompt: 'Change the boundary to absorbing.', hint: 'Use the boundary selector.', observe: 'Waves leave the domain instead of reflecting.', auto: true },
    ],
  },
  {
    id: 'fourier',
    num: 9,
    name: 'The Fourier Transform',
    short: 'Every signal is a chord',
    tex: '\\hat f(\\omega) = \\int_{-\\infty}^{\\infty} f(t)\\,e^{-i\\omega t}\\,dt',
    era: '1807 – 1822; FFT 1965',
    year: 1822,
    people: 'Joseph Fourier; FFT by James Cooley & John Tukey (anticipated by Gauss)',
    palette: { a: '#ffe14d', b: '#ff5d8f', c: '#5dffcf' },
    glyph: 'spectrum',
    see: 'A tangled waveform splits into spinning circles — each one a pure frequency — that rebuild it exactly.',
    problem:
      'How does heat spread through a solid? Fourier needed to solve the heat equation for any starting temperature profile — and found he could if any profile were a sum of simple sine waves.',
    history:
      'Joseph Fourier presented his memoir on heat in 1807 and published *Théorie analytique de la chaleur* in 1822, claiming that arbitrary functions can be written as sums of sines and cosines. The claim met fierce resistance and took a century of analysis to make precise. In 1965 James Cooley and John Tukey published the Fast Fourier Transform, making the computation practical (Gauss had used a similar trick around 1805).',
    breakthrough:
      'Changing viewpoint from **time** to **frequency**. Many problems that are tangled in one view become simple in the other.',
    plain:
      'Any signal — a voice, a heartbeat, a stock chart — can be built by adding pure tones of different pitches, strengths and timings. The Fourier transform tells you which tones and how much of each.',
    symbols: [
      { tex: 'f(t)', name: 'signal', desc: 'The waveform in time.' },
      { tex: '\\hat f(\\omega)', name: 'spectrum', desc: 'A complex number for each angular frequency ω: its size is the amplitude, its angle the phase.' },
      { tex: 'e^{-i\\omega t}', name: 'probe phasor', desc: 'A rotating unit vector; multiplying and integrating measures how much of frequency ω is present.' },
      { tex: '\\omega', name: 'angular frequency', desc: 'Radians per second; $\\omega=2\\pi f$.' },
    ],
    responds:
      'Edit sinusoids, choose presets or draw a waveform. A discrete Fourier transform (FFT, 512 samples) recomputes the spectrum instantly; filters act on the spectrum and the inverse FFT rebuilds the signal.',
    applications: [
      { title: 'Images & audio', body: 'JPEG uses a cousin (the discrete cosine transform); MP3 and AAC audio discard frequencies the ear cannot hear.' },
      { title: 'Medical imaging', body: 'MRI scanners measure data in frequency space and reconstruct images with inverse Fourier transforms.' },
      { title: 'Communications', body: 'Wi-Fi and 4G/5G use OFDM, splitting data across many frequencies computed with FFTs.' },
    ],
    impact:
      'Fourier analysis is the backbone of signal processing, spectroscopy, acoustics, telecommunications, crystallography and the solution of differential equations.',
    caveats:
      'The demo uses the **discrete** Fourier transform of a finite, periodic window of N samples: $X_k=\\sum_n x_n e^{-2\\pi ikn/N}$. It approximates the continuous transform, with effects like leakage and aliasing that the continuous formula does not have.',
    deeper: [
      { title: 'FFT', body: 'The Cooley–Tukey algorithm splits a length-$N$ DFT into two of length $N/2$, recursively, reducing work from $O(N^2)$ to $O(N\\log N)$. The implementation here is tested against a direct DFT.' },
      { title: 'Square waves and Gibbs', body: 'A square wave is $\\tfrac4\\pi\\sum_{k\\,\\mathrm{odd}}\\tfrac1k\\sin(k\\omega t)$. Truncated sums overshoot near jumps by about 9% — the Gibbs phenomenon — however many terms you add.' },
      { title: 'Epicycles', body: 'Each frequency bin is drawn as a circle of radius equal to its amplitude spinning at its frequency, started at its phase. Chained tip-to-tail, they trace the reconstructed signal.' },
    ],
    connections: [
      { to: 'wave', why: 'Vibrations decompose into the normal modes of the wave equation.' },
      { to: 'complex', why: 'Each frequency component is a complex phasor $Ae^{i\\varphi}$.' },
      { to: 'schrodinger', why: 'Position and momentum wavefunctions are Fourier transforms of each other — the root of the uncertainty principle.' },
      { to: 'shannon', why: 'The sampling theorem and channel capacity are statements about bandwidth.' },
    ],
    challenges: [
      { id: 'f-square', prompt: 'Build a square wave and watch its odd harmonics.', hint: 'Choose the Square preset and reduce harmonics.', observe: 'Only odd frequencies appear, with amplitudes ∝ 1/k.', auto: true },
      { id: 'f-filter', prompt: 'Remove the noise with a low-pass filter.', hint: 'Choose “Tone + noise” and lower the cutoff.', observe: 'High-frequency hiss disappears; the tone survives.', auto: true },
      { id: 'f-draw', prompt: 'Draw a waveform and see its spectrum.', hint: 'Choose “Draw” and sketch on the signal panel.', observe: 'Sharp features need many high frequencies; smooth ones need few.', auto: true },
    ],
  },
  {
    id: 'navier-stokes',
    num: 10,
    name: 'Navier–Stokes Equations',
    short: 'The motion of fluids',
    tex: '\\rho\\left(\\frac{\\partial \\mathbf{u}}{\\partial t} + \\mathbf{u}\\cdot\\nabla\\mathbf{u}\\right) = -\\nabla p + \\mu\\nabla^2\\mathbf{u} + \\mathbf{f}',
    texExtra: ['\\nabla\\cdot\\mathbf{u} = 0'],
    era: '1822 – 1845',
    year: 1840,
    people: 'Claude-Louis Navier, George Gabriel Stokes; also Cauchy, Poisson, Saint-Venant',
    palette: { a: '#38f3d4', b: '#ff4fa3', c: '#4f8bff' },
    glyph: 'vortex',
    see: 'Ink curls around an obstacle and sheds a procession of vortices.',
    problem:
      'Euler’s equations of fluid motion (1757) ignored friction and predicted that a body moving through a fluid feels no drag — plainly false. How should internal friction (viscosity) enter?',
    history:
      'Claude-Louis Navier derived the equations in 1822 from a molecular model; George Gabriel Stokes gave a continuum derivation in 1845. Whether smooth solutions always exist in three dimensions is still unknown — one of the Clay Mathematics Institute’s Millennium Prize Problems (2000).',
    breakthrough:
      'Newton’s second law applied to every tiny parcel of fluid: mass × acceleration = pressure push + viscous drag + external forces, with the constraint that an incompressible fluid can’t pile up anywhere.',
    plain:
      'Each bit of fluid speeds up or turns because pressure differences push it, neighbouring fluid drags on it (viscosity), and outside forces act on it. The tricky part is that the fluid carries its own velocity along with it.',
    symbols: [
      { tex: '\\mathbf{u}', name: 'velocity field', desc: 'Speed and direction of the fluid at every point.' },
      { tex: '\\rho', name: 'density', desc: 'Mass per unit volume.' },
      { tex: '\\mathbf{u}\\cdot\\nabla\\mathbf{u}', name: 'advection', desc: 'Fluid carrying its own momentum along — the nonlinear term behind turbulence.' },
      { tex: 'p', name: 'pressure', desc: 'Pushes fluid from high to low pressure; in an incompressible flow it adjusts instantly to keep $\\nabla\\cdot\\mathbf{u}=0$.' },
      { tex: '\\mu', name: 'dynamic viscosity', desc: 'Internal friction. Kinematic viscosity is $\\nu=\\mu/\\rho$.' },
      { tex: '\\mathbf{f}', name: 'body force', desc: 'External force per volume (your mouse drags here).' },
    ],
    responds:
      'Drag to push fluid and inject dye. Viscosity and density change the solver’s coefficients; the pressure solve keeps the flow divergence-free every step.',
    applications: [
      { title: 'Weather & climate', body: 'Forecast and climate models solve versions of these equations for the atmosphere and oceans.' },
      { title: 'Aircraft, cars & ships', body: 'Computational fluid dynamics shapes wings, hulls and car bodies before wind-tunnel tests.' },
      { title: 'Medicine & industry', body: 'Blood flow in arteries, inhalers, pipelines, chemical mixing and cooling systems.' },
    ],
    impact:
      'The Navier–Stokes equations describe nearly every flowing thing we encounter. Approximately solving them on computers transformed engineering, meteorology and climate science.',
    caveats:
      'This is a 2-D incompressible solver at modest resolution (lattice units). Semi-Lagrangian advection adds numerical diffusion, so the effective viscosity is never zero, and the optional vorticity confinement is a numerical correction, not part of the equations. It is a credible demonstration, not a general or validated CFD tool.',
    deeper: [
      { title: 'The algorithm', body: 'Staggered (MAC) grid; each step: semi-Lagrangian advection with RK2 back-tracing → forces → implicit viscosity → pressure projection by solving $\\nabla^2 p=\\nabla\\cdot\\mathbf u^*$ (SOR) and setting $\\mathbf u=\\mathbf u^*-\\nabla p$. The residual divergence is shown live.' },
      { title: 'Reynolds number', body: '$\\mathrm{Re}=UL/\\nu$ compares inertia with viscosity. Low Re: smooth, symmetric flow. Higher Re: vortices shed alternately behind obstacles (a Kármán street).' },
      { title: 'The open problem', body: 'In 3-D, nobody has proved that smooth initial flows stay smooth forever, nor found one that blows up. The Clay Institute offers one million US dollars for settling it.' },
    ],
    connections: [
      { to: 'calculus', why: 'A system of nonlinear partial differential equations.' },
      { to: 'chaos', why: 'Lorenz found chaos in a simplified model of convection derived from these equations.' },
      { to: 'thermodynamics', why: 'Viscosity dissipates kinetic energy into heat, increasing entropy.' },
      { to: 'wave', why: 'Sound is a small compressible ripple in a fluid.' },
    ],
    challenges: [
      { id: 'ns-stir', prompt: 'Stir the fluid and make a vortex.', hint: 'Drag in a circle.', observe: 'The dye rolls up into spirals as the flow rotates.', auto: true },
      { id: 'ns-visc', prompt: 'Make the fluid as viscous as honey and stir again.', hint: 'Raise viscosity to the top of its range.', observe: 'Motion dies quickly and smoothly: viscosity diffuses momentum.', auto: true },
      { id: 'ns-pressure', prompt: 'Look at the pressure field around an obstacle.', hint: 'Choose the Pressure view.', observe: 'High pressure on the upstream face, low pressure in the wake.', auto: true },
    ],
  },
  {
    id: 'maxwell',
    num: 11,
    name: 'Maxwell’s Equations',
    short: 'Light, electricity and magnetism unified',
    tex: '\\nabla\\cdot\\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}',
    texExtra: [
      '\\nabla\\cdot\\mathbf{B} = 0',
      '\\nabla\\times\\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}',
      '\\nabla\\times\\mathbf{B} = \\mu_0\\mathbf{J} + \\mu_0\\varepsilon_0\\frac{\\partial \\mathbf{E}}{\\partial t}',
    ],
    era: '1861 – 1865',
    year: 1865,
    people: 'James Clerk Maxwell; built on Gauss, Ampère, Faraday; vector form by Oliver Heaviside & Josiah Willard Gibbs; radio waves confirmed by Heinrich Hertz (1887)',
    palette: { a: '#ffcf4a', b: '#4aa8ff', c: '#ff5f6d' },
    glyph: 'field',
    see: 'Field lines spring from charges; changing fields chase each other across space as light.',
    problem:
      'Electricity and magnetism were known to be linked — currents deflect compasses, moving magnets drive currents — but the laws were a patchwork that did not quite fit together.',
    history:
      'Maxwell combined the laws of Gauss, Ampère and Faraday, adding a crucial new term — the *displacement current* — in papers of 1861–62 and 1865. His equations predicted waves of electric and magnetic field travelling at about the measured speed of light, so he proposed that light *is* such a wave. Heinrich Hertz generated and detected radio waves in 1887–88. The compact vector form is due to Oliver Heaviside and others.',
    breakthrough:
      'A changing magnetic field makes an electric field (Faraday), and — Maxwell’s addition — a changing electric field makes a magnetic field. Together they sustain each other as a **self-propagating wave**.',
    plain:
      'Charges make electric fields that spread outward. There are no magnetic charges, so magnetic field lines always loop back. Changing magnetic fields create swirling electric fields, and currents or changing electric fields create swirling magnetic fields.',
    symbols: [
      { tex: '\\mathbf{E},\\ \\mathbf{B}', name: 'electric & magnetic fields', desc: 'Force per unit charge (V/m) and magnetic flux density (tesla).' },
      { tex: '\\rho,\\ \\mathbf{J}', name: 'charge & current density', desc: 'Sources of the fields.' },
      { tex: '\\varepsilon_0,\\ \\mu_0', name: 'vacuum permittivity & permeability', desc: '$8.854\\times10^{-12}$ F/m and $1.2566\\times10^{-6}$ N/A².' },
      { tex: '\\nabla\\cdot,\\ \\nabla\\times', name: 'divergence & curl', desc: 'How much a field spreads out from a point, and how much it swirls around it.' },
    ],
    responds:
      'Select an equation to open the scene that demonstrates it. Place charges and wires; the field lines are traced from exact formulas and the flux or circulation around your loop is integrated numerically and compared with the law.',
    applications: [
      { title: 'Wireless everything', body: 'Radio, television, radar, mobile phones, Wi-Fi and GPS are electromagnetic waves designed with Maxwell’s equations.' },
      { title: 'Electric power', body: 'Generators and transformers run on Faraday’s law of induction.' },
      { title: 'Optics & imaging', body: 'Lenses, fibre optics, lasers and MRI are all electromagnetic engineering.' },
    ],
    impact:
      'Maxwell’s equations unified electricity, magnetism and light; they underpin the electrical and telecommunications age and set the stage for relativity.',
    caveats:
      'Here charges and wires are idealised as infinitely long and perpendicular to the screen (so fields fall as 1/r in the 2-D slice), the solenoid field is uniform, and the wave is a 1-D plane wave computed with a Yee FDTD scheme. These are exact for their idealised setups, not a general electromagnetic solver.',
    deeper: [
      { title: 'Integral forms', body: 'Gauss: $\\oint\\mathbf E\\cdot d\\mathbf A=Q_{enc}/\\varepsilon_0$. Ampère–Maxwell: $\\oint\\mathbf B\\cdot d\\mathbf l=\\mu_0 I_{enc}+\\mu_0\\varepsilon_0\\,d\\Phi_E/dt$. Faraday: $\\oint\\mathbf E\\cdot d\\mathbf l=-d\\Phi_B/dt$.' },
      { title: 'Deriving light', body: 'In vacuum, taking the curl of Faraday’s law and using Ampère–Maxwell gives $\\nabla^2\\mathbf E=\\mu_0\\varepsilon_0\\,\\partial^2\\mathbf E/\\partial t^2$ — a wave equation with speed $1/\\sqrt{\\mu_0\\varepsilon_0}=299\\,792\\,458$ m/s.' },
      { title: 'Without the displacement current', body: 'Drop $\\mu_0\\varepsilon_0\\partial\\mathbf E/\\partial t$ and the curl of B is fixed by currents alone; the coupled E–B oscillation cannot sustain itself and no wave propagates. Toggle it in the wave scene.' },
    ],
    connections: [
      { to: 'wave', why: 'In empty space each field component satisfies the wave equation.' },
      { to: 'relativity', why: 'The constancy of the speed of light in Maxwell’s theory led Einstein to special relativity.' },
      { to: 'complex', why: 'Engineers analyse AC fields and circuits with complex phasors.' },
      { to: 'gravity', why: 'The electric field of a point charge follows an inverse-square law like gravity.' },
    ],
    challenges: [
      { id: 'mx-gauss', prompt: 'Draw a Gaussian loop around charges and check the flux.', hint: 'Gauss scene: drag the loop; compare flux with λ/ε₀.', observe: 'Charges outside the loop contribute nothing to the net flux.', auto: true },
      { id: 'mx-ampere', prompt: 'Check Ampère’s law around a wire.', hint: 'Magnetism scene: move the loop to enclose a current.', observe: '∮B·dl = μ₀I_enclosed, and ∮B·n dl is always 0 (no magnetic charges).', auto: true },
      { id: 'mx-disp', prompt: 'Switch off the displacement current.', hint: 'In the wave scene untick Maxwell’s term.', observe: 'The wave can no longer propagate.', auto: true },
    ],
  },
  {
    id: 'thermodynamics',
    num: 12,
    name: 'Second Law of Thermodynamics',
    short: 'Why time has a direction',
    tex: '\\Delta S \\geq 0',
    texExtra: ['S = k_B \\ln \\Omega'],
    era: '1824 – 1877',
    year: 1850,
    people: 'Sadi Carnot, Rudolf Clausius, William Thomson (Lord Kelvin), Ludwig Boltzmann, J. Willard Gibbs',
    palette: { a: '#ff7a45', b: '#45b6ff', c: '#ffd9a8' },
    glyph: 'particles',
    see: 'A barrier lifts. Particles flood the empty chamber and never all return.',
    problem:
      'Why can no engine turn heat entirely into work? Why does heat flow from hot to cold, never the reverse by itself?',
    history:
      'Sadi Carnot analysed the efficiency of heat engines in 1824. Rudolf Clausius stated the second law in 1850 and coined “entropy” in 1865; Kelvin gave an equivalent statement in 1851. Ludwig Boltzmann (1870s) explained entropy statistically by counting microscopic arrangements — the relation now written $S=k_B\\ln\\Omega$.',
    breakthrough:
      'Entropy counts **how many microscopic arrangements** are consistent with what we observe. Systems drift towards macrostates with overwhelmingly more arrangements simply because those are vastly more probable.',
    plain:
      'There are astronomically more ways for gas molecules to be spread throughout a box than to be bunched in one corner. Left alone, an isolated system wanders into the most probable kind of state — and its entropy rises.',
    symbols: [
      { tex: 'S', name: 'entropy', desc: 'Measured in J/K. Here shown as $S/k_B=\\ln\\Omega$.' },
      { tex: '\\Delta S\\ge0', name: 'second law', desc: 'For an isolated system, entropy never decreases. Equality holds for idealised reversible processes.' },
      { tex: '\\Omega', name: 'multiplicity', desc: 'Number of microstates (arrangements) compatible with a macrostate.' },
      { tex: 'k_B', name: 'Boltzmann constant', desc: '$1.380649\\times10^{-23}$ J/K, converting the count into thermodynamic units.' },
    ],
    responds:
      'The particles are a real hard-disc gas with elastic collisions. Entropy is computed from the coarse-grained cell occupancies as $\\ln\\Omega=\\ln N!-\\sum\\ln n_i!$ every frame.',
    applications: [
      { title: 'Engines & power plants', body: 'Carnot’s limit $1-T_c/T_h$ caps the efficiency of every heat engine, from car motors to power stations.' },
      { title: 'Refrigeration & heat pumps', body: 'Moving heat “uphill” requires work, exactly as the second law demands.' },
      { title: 'Chemistry & computing', body: 'Whether a reaction runs is governed by entropy and free energy; Landauer’s principle sets a minimum energy cost for erasing information.' },
    ],
    impact:
      'The second law sets the ultimate limits on engines and energy technology, explains the direction of chemical reactions and the arrow of time, and links physics to information.',
    caveats:
      'Entropy is not simply “disorder”. Local entropy can decrease (a fridge, a growing crystal, a living cell) provided total entropy including the surroundings increases. The law is statistical: tiny systems fluctuate, but large decreases become absurdly improbable.',
    deeper: [
      { title: 'Probability of un-mixing', body: 'Each of $N$ independent particles is in the left half with probability ½, so all being left has probability $2^{-N}$. For 10 particles that is about 1 in 1000; for 100 it is $8\\times10^{-31}$; for a mole it is unthinkable.' },
      { title: 'Coarse graining', body: 'Entropy depends on what we choose to observe. Using a $g\\times g$ grid of cells, $\\Omega=N!/\\prod n_i!$ counts assignments of distinguishable particles to cells. Finer grids raise $\\ln\\Omega$ but the trend is the same.' },
      { title: 'Reversibility paradox', body: 'The microscopic laws are time-reversible (try “reverse velocities”). With few particles you may see order return; with many, tiny numerical and collision errors grow chaotically and the reversal fails — a hint of why we never observe it.' },
    ],
    connections: [
      { to: 'shannon', why: 'Shannon’s information entropy has the same mathematical form as Gibbs’s entropy.' },
      { to: 'logarithms', why: 'Entropy is a logarithm of the number of microstates.' },
      { to: 'normal', why: 'Molecular velocity components follow a normal distribution in equilibrium.' },
      { to: 'navier-stokes', why: 'Viscous flow dissipates energy and produces entropy.' },
    ],
    challenges: [
      { id: 'th-release', prompt: 'Remove the partition and watch the entropy.', hint: 'Press “Release partition”.', observe: 'ln Ω climbs and then fluctuates just below its maximum.', auto: true },
      { id: 'th-small', prompt: 'Use 10 particles. Do they ever all gather on the left again?', hint: 'Set N = 10 and release.', observe: 'Occasionally, yes — about 1 time in 1000 — because the law is statistical.', auto: true },
      { id: 'th-reverse', prompt: 'Reverse every velocity after mixing.', hint: 'Press “Reverse velocities”.', observe: 'Small systems may briefly un-mix; large ones essentially never return.', auto: true },
    ],
  },
  {
    id: 'relativity',
    num: 13,
    name: 'Mass–Energy Equivalence',
    short: 'Matter as stored energy',
    tex: 'E = mc^2',
    texExtra: ['E^2 = (pc)^2 + (mc^2)^2'],
    era: '1905',
    year: 1905,
    people: 'Albert Einstein; precursors in electromagnetism by Poincaré, Hasenöhrl and others; tested by Cockcroft & Walton (1932)',
    palette: { a: '#fff3c4', b: '#ff9a3c', c: '#8ad8ff' },
    glyph: 'burst',
    see: 'A speck of matter sits in the dark. Its locked-up energy, shown to scale, swallows the sky.',
    problem:
      'Special relativity rebuilt space and time around the constancy of light’s speed. What did that imply about energy and mass?',
    history:
      'In September 1905 Albert Einstein published a three-page paper asking whether a body’s inertia depends on its energy content, concluding that a body emitting energy $E$ as light loses mass $E/c^2$. Earlier work on electromagnetic mass hinted at the idea. Mass–energy equivalence was confirmed in nuclear reactions, first quantitatively by Cockcroft and Walton in 1932.',
    breakthrough:
      'Mass is a form of energy. Even a body at rest has **rest energy** $mc^2$, and because $c^2$ is enormous, a tiny mass corresponds to a colossal energy.',
    plain:
      'The speed of light squared is about 90 quadrillion (9×10¹⁶) in SI units, so one gram of mass is equivalent to roughly 9×10¹³ joules — comparable to a 20-kiloton explosion.',
    symbols: [
      { tex: 'E', name: 'rest energy', desc: 'In joules.' },
      { tex: 'm', name: 'mass', desc: 'Rest (invariant) mass, in kilograms.' },
      { tex: 'c', name: 'speed of light', desc: 'Exactly 299 792 458 m/s by definition of the metre.' },
      { tex: 'p', name: 'momentum', desc: 'For a moving body the full relation is $E^2=(pc)^2+(mc^2)^2$.' },
    ],
    responds:
      'Change the mass and unit; the energy is computed exactly as $mc^2$ and converted to kWh, tonnes of TNT and comparison scales. The process selector shows how much mass real processes actually convert.',
    applications: [
      { title: 'Why the Sun shines', body: 'Fusion in the Sun converts about 4 million tonnes of mass to energy every second.' },
      { title: 'Nuclear power', body: 'Fission releases about 0.09% of the mass of the uranium-235 that splits; the energy bookkeeping is mass–energy equivalence.' },
      { title: 'Medicine & particle physics', body: 'PET scans detect 511 keV photons from electron–positron annihilation; colliders turn energy into new particles.' },
    ],
    impact:
      'E = mc² explained the energy source of stars and the energetics of nuclear physics, and became the most recognisable equation in the world.',
    caveats:
      'The equation does not explain *how* to release energy. Chemical reactions convert well under a billionth of the mass (about 10⁻¹⁰ for burning petrol); fission about 0.1%; fusion about 0.4–0.7%; only matter–antimatter annihilation converts all of it. Comparisons below are approximate and for scale only.',
    deeper: [
      { title: 'The numbers', body: '$c^2=8.98755\\times10^{16}\\ \\mathrm{m^2/s^2}$. 1 tonne of TNT is defined as $4.184\\times10^9$ J; 1 kWh $=3.6\\times10^6$ J.' },
      { title: 'Mass defect', body: 'A helium-4 nucleus is about 0.7% lighter than two protons plus two neutrons; that missing mass is the binding energy released when it forms.' },
      { title: 'Moving bodies', body: 'The total energy is $\\gamma mc^2$ with $\\gamma=1/\\sqrt{1-v^2/c^2}$. For a massless photon, $E=pc$.' },
    ],
    connections: [
      { to: 'maxwell', why: 'Relativity grew out of the electrodynamics of moving bodies.' },
      { to: 'pythagoras', why: '$E^2=(pc)^2+(mc^2)^2$ is a right triangle in energy–momentum space.' },
      { to: 'gravity', why: 'General relativity, Einstein’s theory of gravity, followed in 1915.' },
      { to: 'schrodinger', why: 'Dirac merged relativity with quantum mechanics and predicted antimatter.' },
    ],
    challenges: [
      { id: 'emc-gram', prompt: 'Find the energy of one gram.', hint: 'Set the mass to 1 g.', observe: '≈ 8.99 × 10¹³ J ≈ 21 kilotonnes of TNT equivalent.', auto: true },
      { id: 'emc-hiro', prompt: 'What mass corresponds to the Hiroshima bomb (≈ 15 kt)?', hint: 'Adjust mass until the TNT readout shows ~15 kt.', observe: 'About 0.7 grams — the bomb converted under a gram of mass.', auto: true },
      { id: 'emc-process', prompt: 'Compare chemical, fission and fusion processes.', hint: 'Use the process selector.', observe: 'Burning releases ~10⁻¹⁰ of mc²; fission ~10⁻³; fusion several times more.', auto: true },
    ],
  },
  {
    id: 'schrodinger',
    num: 14,
    name: 'The Schrödinger Equation',
    short: 'The wave of quantum possibility',
    tex: 'i\\hbar\\,\\frac{\\partial \\psi}{\\partial t} = \\hat H \\psi',
    texExtra: ['\\hat H\\psi = E\\psi,\\quad \\hat H = -\\frac{\\hbar^2}{2m}\\frac{d^2}{dx^2} + V(x)'],
    era: '1926',
    year: 1926,
    people: 'Erwin Schrödinger; building on Louis de Broglie; probability interpretation by Max Born; alongside Heisenberg’s matrix mechanics',
    palette: { a: '#9b7bff', b: '#3df5ff', c: '#ff7ae0' },
    glyph: 'psi',
    see: 'Standing waves of probability amplitude settle into a well, each with one more node than the last.',
    problem:
      'Atoms emit light only at specific colours, and electrons diffract like waves. Classical physics could not explain either. What equation governs matter waves?',
    history:
      'Louis de Broglie proposed in 1924 that particles have wavelengths. In 1926 Erwin Schrödinger published a series of papers introducing his wave equation and reproducing the hydrogen spectrum. Max Born interpreted $|\\psi|^2$ as a probability density the same year; Heisenberg, Born and Jordan had developed an equivalent matrix mechanics in 1925.',
    breakthrough:
      'Energy quantisation emerges naturally: only special standing-wave shapes — **eigenstates** — fit a given potential, each with a definite energy.',
    plain:
      'A quantum particle is described by a complex wavefunction ψ. Where |ψ|² is large, a measurement is likely to find the particle. Trapped particles can only have certain energies, just as a guitar string can only sound certain notes.',
    symbols: [
      { tex: '\\psi(x,t)', name: 'wavefunction', desc: 'A complex probability amplitude, not a physical cloud of matter.' },
      { tex: '|\\psi|^2', name: 'probability density', desc: 'Probability per unit length of finding the particle at x; $\\int|\\psi|^2dx=1$.' },
      { tex: '\\hbar', name: 'reduced Planck constant', desc: '$1.0546\\times10^{-34}$ J·s $=0.6582$ eV·fs.' },
      { tex: '\\hat H', name: 'Hamiltonian', desc: 'Total-energy operator: kinetic $-\\frac{\\hbar^2}{2m}\\frac{d^2}{dx^2}$ plus potential $V(x)$.' },
      { tex: 'E', name: 'energy eigenvalue', desc: 'Allowed energy of a stationary state.' },
    ],
    responds:
      'Choose a potential; the Hamiltonian is discretised on 400 points and diagonalised, giving real energies (eV) and eigenstates for an electron. Time evolution uses the exact phase rotation $e^{-iE_nt/\\hbar}$ of each eigenstate.',
    applications: [
      { title: 'Chemistry', body: 'Atomic orbitals, chemical bonds and molecular shapes come from solving (approximations to) the Schrödinger equation.' },
      { title: 'Electronics', body: 'Band structure of semiconductors — the basis of transistors, LEDs and solar cells — and quantum tunnelling in flash memory.' },
      { title: 'New technology', body: 'Lasers, MRI, scanning tunnelling microscopes and quantum computers rely on quantum mechanics.' },
    ],
    impact:
      'Quantum mechanics explains the periodic table, chemistry, solids and light–matter interaction. A large fraction of modern technology depends on devices designed with it.',
    caveats:
      'This is non-relativistic, one-dimensional and for a single electron in a box of finite width with impenetrable walls. The wavefunction is a mathematical object; how measurement works remains debated in the interpretation of quantum mechanics.',
    deeper: [
      { title: 'The solver', body: 'With grid spacing $h$, $-\\frac{\\hbar^2}{2m}\\psi\'\'\\approx-\\frac{\\hbar^2}{2m}\\frac{\\psi_{j+1}-2\\psi_j+\\psi_{j-1}}{h^2}$ gives a symmetric tridiagonal matrix. Eigenvalues are found by Sturm-sequence bisection and eigenvectors by inverse iteration, then normalised so $\\sum|\\psi_j|^2h=1$. Infinite-well energies match $n^2\\pi^2\\hbar^2/2mL^2$ to <0.2%.' },
      { title: 'Nodes', body: 'The $n$-th stationary state of a 1-D potential has exactly $n-1$ nodes — a theorem of Sturm–Liouville theory you can verify by counting.' },
      { title: 'Superposition', body: 'A mix $c_1\\psi_1+c_2\\psi_2$ is not stationary: $|\\psi|^2$ sloshes at angular frequency $(E_2-E_1)/\\hbar$ because the components rotate in phase at different rates.' },
    ],
    connections: [
      { to: 'complex', why: 'The $i$ in the equation makes ψ rotate in the complex plane.' },
      { to: 'fourier', why: 'Momentum-space and position-space wavefunctions are Fourier pairs.' },
      { to: 'wave', why: 'A wave equation — but dispersive and complex-valued.' },
      { to: 'relativity', why: 'Dirac’s relativistic version predicted antimatter.' },
    ],
    challenges: [
      { id: 'q-nodes', prompt: 'Select the third state. How many nodes does it have?', hint: 'Click the n = 3 level.', observe: 'Two nodes: state n has n − 1.', auto: true },
      { id: 'q-super', prompt: 'Superpose two states and watch |ψ|² slosh.', hint: 'Turn on a second state in superposition mode.', observe: 'The density oscillates at (E₂ − E₁)/ħ.', auto: true },
      { id: 'q-tunnel', prompt: 'Fire a wave packet at a barrier.', hint: 'Choose the Barrier potential and press “Launch packet”.', observe: 'Part of the packet tunnels through even when its energy is below the barrier.', auto: true },
    ],
  },
  {
    id: 'shannon',
    num: 15,
    name: 'Information Entropy',
    short: 'Measuring surprise in bits',
    tex: 'H(X) = -\\sum_{x} p(x)\\,\\log_2 p(x)',
    era: '1948',
    year: 1948,
    people: 'Claude Shannon; earlier ideas by Harry Nyquist and Ralph Hartley; Huffman coding by David Huffman (1952)',
    palette: { a: '#7dff9a', b: '#33c3ff', c: '#f7ff6b' },
    glyph: 'bits',
    see: 'A stream of symbols flows past. Predictable streams compress to almost nothing; surprising ones cannot.',
    problem:
      'How much can a message be compressed, and how fast can information be sent reliably over a noisy telephone line?',
    history:
      'Claude Shannon’s 1948 paper “A Mathematical Theory of Communication” defined information entropy, proved that it is the limit of lossless compression, and showed that every noisy channel has a capacity below which error-free communication is possible. Nyquist and Hartley had taken earlier steps. David Huffman, a student, invented optimal prefix codes in 1952.',
    breakthrough:
      'Information is **reduction of uncertainty**, and it can be measured in bits independently of meaning. The average surprise of a source sets a hard limit on how far its messages can be compressed.',
    plain:
      'A rare event is surprising and carries a lot of information; a certain event carries none. Entropy is the average surprise per symbol: how many yes/no questions you need, on average, to identify each symbol.',
    symbols: [
      { tex: 'p(x)', name: 'probability', desc: 'Chance of symbol x; the probabilities sum to 1.' },
      { tex: '-\\log_2 p(x)', name: 'surprisal', desc: 'Information in seeing x, in bits. A 50/50 outcome carries 1 bit.' },
      { tex: 'H(X)', name: 'entropy', desc: 'Expected surprisal: between 0 (certain) and $\\log_2 n$ (all n symbols equally likely).' },
    ],
    responds:
      'Drag the probability bars (they renormalise to sum to 1). Entropy, surprisal, the Huffman code and its average length update instantly; the sampled stream is compressed with the code you see.',
    applications: [
      { title: 'Compression', body: 'ZIP and PNG use DEFLATE (LZ77 + Huffman coding); video and audio codecs use entropy coding as a final stage.' },
      { title: 'Reliable communication', body: 'Error-correcting codes in phones, deep-space probes and storage approach Shannon’s capacity limit.' },
      { title: 'Machine learning & science', body: 'Cross-entropy loss trains classifiers; mutual information quantifies dependence in neuroscience and genetics.' },
    ],
    impact:
      'Shannon’s theory founded the digital age: it tells engineers what is possible in compression, transmission and storage, and it introduced the “bit” as a universal unit.',
    caveats:
      'Entropy is an *expected* quantity for a probabilistic source, not a property of one particular file, and it says nothing about meaning. Real compressors also exploit correlations between symbols, which this single-symbol model ignores.',
    deeper: [
      { title: 'Source coding theorem', body: 'Any uniquely decodable code has average length $L\\ge H$; Huffman’s algorithm achieves $H\\le L<H+1$, with equality when every probability is a power of ½.' },
      { title: 'Huffman’s algorithm', body: 'Repeatedly merge the two least probable symbols into a node; the path of 0s and 1s from the root to each leaf is that symbol’s code word.' },
      { title: 'Why logarithms', body: 'Information from independent events should add while probabilities multiply. Only the logarithm (up to scale) turns products into sums; base 2 measures in bits.' },
    ],
    connections: [
      { to: 'logarithms', why: 'Bits are base-2 logarithms of probabilities.' },
      { to: 'thermodynamics', why: 'Same formula as Gibbs entropy; Landauer linked erasing information to heat.' },
      { to: 'fourier', why: 'Channel capacity $C=B\\log_2(1+S/N)$ depends on bandwidth.' },
      { to: 'chaos', why: 'Chaotic systems generate information at a rate set by their Lyapunov exponents.' },
    ],
    challenges: [
      { id: 'sh-2bits', prompt: 'Make the entropy exactly 2 bits.', hint: 'Four equally likely symbols.', observe: 'Uniform over 4 symbols: H = log₂4 = 2.', auto: true },
      { id: 'sh-zero', prompt: 'Make the source completely predictable.', hint: 'Use the Deterministic preset.', observe: 'H = 0: no surprise, nothing to transmit.', auto: true },
      { id: 'sh-dyadic', prompt: 'Find a distribution where Huffman coding is perfect.', hint: 'Try probabilities ½, ¼, ⅛, ⅛.', observe: 'Average code length equals the entropy exactly.', auto: true },
    ],
  },
  {
    id: 'chaos',
    num: 16,
    name: 'Chaos & the Logistic Map',
    short: 'Simple rules, unpredictable futures',
    tex: 'x_{n+1} = r\\,x_n(1 - x_n)',
    era: '1838; 1970s',
    year: 1975,
    people: 'Pierre François Verhulst; Robert May, Mitchell Feigenbaum, Tien-Yien Li & James Yorke; Edward Lorenz',
    palette: { a: '#ff5cf0', b: '#ffa83d', c: '#7af0ff' },
    glyph: 'bifurcation',
    see: 'One point, one rule. Turn the dial and stable order splits, splits again, and dissolves into chaos.',
    problem:
      'Can a perfectly deterministic rule produce behaviour that looks random and cannot be predicted in practice?',
    history:
      'Verhulst introduced the logistic equation for population growth in 1838. In 1976 the ecologist Robert May showed in *Nature* that its discrete version produces astonishingly complex dynamics. Li and Yorke (1975) proved “period three implies chaos”, and Feigenbaum (1975–78) discovered that period-doubling cascades share universal constants. Edward Lorenz had found sensitive dependence in a weather model in 1963.',
    breakthrough:
      '**Deterministic chaos**: tiny differences in starting conditions grow exponentially, making long-range prediction impossible even though nothing random is happening.',
    plain:
      'x is a population as a fraction of its maximum. Next year’s population grows by a factor r but is limited by crowding (1 − x). For small r it settles down; for larger r it oscillates; beyond about 3.57 it can become chaotic.',
    symbols: [
      { tex: 'x_n', name: 'state', desc: 'Population fraction in generation n, between 0 and 1.' },
      { tex: 'r', name: 'growth parameter', desc: 'Between 0 and 4. Controls everything: stable, periodic or chaotic.' },
      { tex: '1-x_n', name: 'crowding term', desc: 'Limits growth as the population approaches capacity.' },
      { tex: '\\lambda', name: 'Lyapunov exponent', desc: 'Average rate at which nearby orbits separate: $\\lambda>0$ indicates chaos.' },
    ],
    responds:
      'Every point is computed by actually iterating the map. The bifurcation diagram iterates past a transient for each r and plots where the orbit lands; the cobweb shows each step graphically.',
    applications: [
      { title: 'Weather prediction', body: 'Sensitive dependence limits forecasts to about two weeks; meteorologists run ensembles of slightly perturbed forecasts.' },
      { title: 'Biology & medicine', body: 'Population booms and crashes, heart rhythms and neural activity show chaotic or near-chaotic dynamics.' },
      { title: 'Engineering', body: 'Controlling chaos stabilises lasers and circuits; mixing in fluids exploits chaotic stretching.' },
    ],
    impact:
      'Chaos theory overturned the assumption that simple deterministic laws imply predictable behaviour, reshaping meteorology, ecology, physics and our sense of the limits of prediction.',
    caveats:
      'Chaos is not randomness: the same x₀ and r always give the same sequence. And not every r is chaotic — periodic windows (like period 3 near r ≈ 3.83) sit inside the chaotic region.',
    deeper: [
      { title: 'Fixed points & stability', body: 'Fixed point $x^*=1-1/r$ is stable when $|f\'(x^*)|=|2-r|<1$, i.e. $1<r<3$. At $r=3$ it loses stability and a period-2 cycle is born.' },
      { title: 'Feigenbaum’s constant', body: 'Successive period-doubling values $r_k$ approach $r_\\infty\\approx3.5699$ with gaps shrinking by $\\delta\\approx4.6692$ — the same constant appears in many unrelated systems.' },
      { title: 'Lyapunov exponent', body: '$\\lambda=\\lim\\frac1N\\sum\\ln|r(1-2x_n)|$. At $r=4$ it equals $\\ln 2$: errors double every step, so a 15-digit starting value is useless after about 50 iterations.' },
    ],
    connections: [
      { to: 'navier-stokes', why: 'Lorenz discovered chaos in a stripped-down model of fluid convection.' },
      { to: 'gravity', why: 'Poincaré found chaos in the three-body problem of gravitation.' },
      { to: 'shannon', why: 'Chaotic dynamics produce information at a rate set by the Lyapunov exponent.' },
      { to: 'logarithms', why: 'The Lyapunov exponent is an average logarithm of stretching.' },
    ],
    challenges: [
      { id: 'lg-p2', prompt: 'Find a period-2 cycle.', hint: 'Set r between 3 and 3.449.', observe: 'The population alternates between two values forever.', auto: true },
      { id: 'lg-chaos', prompt: 'Push r into the chaotic region.', hint: 'Try r = 3.9.', observe: 'No repeating pattern; the Lyapunov exponent is positive.', auto: true },
      { id: 'lg-p3', prompt: 'Find the period-3 window.', hint: 'Look near r ≈ 3.83.', observe: 'Order returns inside chaos: a stable 3-cycle.', auto: true },
      { id: 'lg-butterfly', prompt: 'Compare two starts differing by 10⁻⁶ in chaos.', hint: 'Turn on “Compare nearby start” with r > 3.6.', observe: 'They track each other briefly, then diverge completely.', auto: true },
    ],
  },
  {
    id: 'black-scholes',
    num: 17,
    name: 'The Black–Scholes Equation',
    short: 'Pricing uncertainty',
    tex: '\\frac{\\partial V}{\\partial t} + \\tfrac12\\sigma^2 S^2\\frac{\\partial^2 V}{\\partial S^2} + rS\\frac{\\partial V}{\\partial S} - rV = 0',
    era: '1973',
    year: 1973,
    people: 'Fischer Black, Myron Scholes, Robert C. Merton; building on Louis Bachelier (1900) and Kiyosi Itô',
    palette: { a: '#4dffb0', b: '#ffcf5c', c: '#5c9dff' },
    glyph: 'surface',
    see: 'A landscape of option value rises and melts as time runs out, collapsing onto the hockey-stick payoff.',
    problem:
      'An option gives the right — not the obligation — to buy or sell at a fixed price later. What is that right worth today, when the future price is uncertain?',
    history:
      'Louis Bachelier modelled prices with random walks in 1900. In 1973 Fischer Black and Myron Scholes, with Robert Merton, showed that an option can be hedged by continuously trading the underlying asset, which pins down a unique fair price in their model. The Chicago Board Options Exchange opened the same year. Merton and Scholes received the 1997 Nobel Memorial Prize in Economic Sciences; Black had died in 1995.',
    breakthrough:
      'By holding a carefully adjusted amount of stock (the **delta hedge**), the risk can in principle be cancelled — so the option’s price cannot depend on anyone’s expectations of return, only on volatility and the risk-free rate.',
    plain:
      'The value of an option depends on the current price, the strike, time left, how wildly the price moves (volatility), and the interest rate. More volatility or more time make a big payoff more possible, so the option is worth more.',
    symbols: [
      { tex: 'V(S,t)', name: 'option value', desc: 'Price of the option as a function of the asset price and time.' },
      { tex: 'S', name: 'underlying price', desc: 'Current price of the stock or asset.' },
      { tex: '\\sigma', name: 'volatility', desc: 'Annualised standard deviation of log-returns.' },
      { tex: 'r', name: 'risk-free rate', desc: 'Continuously compounded interest rate.' },
      { tex: 'K,\\ T', name: 'strike & expiry', desc: 'Contract price and time of expiry; the payoff at T is $\\max(S-K,0)$ for a call.' },
    ],
    responds:
      'The surface is the closed-form price across asset prices and times to expiry. Change any parameter and the surface, the price curve, the Greeks and a Crank–Nicolson numerical solution of the PDE all update together.',
    applications: [
      { title: 'Options markets', body: 'Traders quote prices in terms of “implied volatility” — the σ that makes the formula match the market price.' },
      { title: 'Risk management', body: 'The Greeks (Δ, Γ, ν, Θ, ρ) measure sensitivity to each input and guide hedging.' },
      { title: 'Beyond finance', body: '“Real options” methods value flexible investment decisions in energy, R&D and infrastructure.' },
    ],
    impact:
      'Black–Scholes turned option pricing into engineering and helped derivatives markets grow enormously — making hedging cheaper, but also enabling large, complex exposures whose risks were sometimes underestimated.',
    caveats:
      'Illustrative calculations only — **not investment advice**. The model assumes constant volatility, continuous frictionless trading, no jumps, and log-normally distributed prices. Real markets show volatility smiles, fat tails and sudden jumps; models misused under stress have contributed to losses (e.g. LTCM in 1998).',
    deeper: [
      { title: 'Closed form', body: 'For a European call: $C=S\\,N(d_1)-Ke^{-rT}N(d_2)$, $d_{1,2}=\\dfrac{\\ln(S/K)+(r\\pm\\tfrac12\\sigma^2)T}{\\sigma\\sqrt T}$. Put–call parity: $C-P=S-Ke^{-rT}$.' },
      { title: 'Numerical PDE', body: 'The PDE is solved backward from the payoff on a grid of 300 price points with Crank–Nicolson time-stepping (with Rannacher start-up to tame the payoff kink). Its value at your S is compared with the formula.' },
      { title: 'The heat equation inside', body: 'Substituting $S=Ke^x$ and rescaling time turns Black–Scholes into the heat equation $u_\\tau=u_{xx}$ — the same equation Fourier studied.' },
    ],
    connections: [
      { to: 'normal', why: 'Log-returns are assumed normal; $N(d_1)$ and $N(d_2)$ are normal probabilities.' },
      { to: 'calculus', why: 'It is a partial differential equation derived with stochastic (Itô) calculus.' },
      { to: 'fourier', why: 'It transforms into the heat equation that inspired Fourier analysis.' },
      { to: 'logarithms', why: 'Returns are modelled on a logarithmic scale.' },
    ],
    challenges: [
      { id: 'bs-vol', prompt: 'Double the volatility. What happens to the price?', hint: 'Move σ from 20% to 40%.', observe: 'Both calls and puts become more valuable: more uncertainty, more optionality.', auto: true },
      { id: 'bs-expiry', prompt: 'Run time to expiry down to zero.', hint: 'Drag T towards 0.', observe: 'The curve collapses onto the payoff max(S − K, 0).', auto: true },
      { id: 'bs-pde', prompt: 'Compare the PDE solver with the formula.', hint: 'Look at the “Numerical PDE” readout.', observe: 'They agree to about a cent: two routes to the same answer.', auto: true },
    ],
  },
];

export const EQ_BY_ID: Record<string, Equation> = Object.fromEntries(EQUATIONS.map((e) => [e.id, e]));

/** Undirected connection list for the relationship map. */
export function allConnections(): { a: string; b: string; why: string }[] {
  const seen = new Set<string>();
  const out: { a: string; b: string; why: string }[] = [];
  for (const e of EQUATIONS)
    for (const c of e.connections) {
      if (!EQ_BY_ID[c.to]) continue;
      const key = [e.id, c.to].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ a: e.id, b: c.to, why: c.why });
    }
  return out;
}
