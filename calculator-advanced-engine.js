/* math.js 11.11 + Nerdamer 1.1.13 run inside a disposable, time-limited Worker. */
function advancedCalculate(d){
 const fmt=v=>math.format(v,{precision:14}), lines=(...pairs)=>({result:pairs.map(([k,v])=>k+': '+(typeof v==='string'?v:fmt(v))).join('\n')});
 const finite=(x,name='Value')=>{if(!Number.isFinite(Number(x)))throw Error(name+' must be finite.');return Number(x)};
 const expression=String(d.expression||'');if(expression.length>1000)throw Error('Use an expression under 1,000 characters.');
 function matrix(raw){const a=JSON.parse(raw);if(!Array.isArray(a)||!a.length||a.length>12||!Array.isArray(a[0])||!a[0].length||a[0].length>12||a.some(r=>!Array.isArray(r)||r.length!==a[0].length||r.some(x=>typeof x!=='number'||!Number.isFinite(x))))throw Error('Use a rectangular JSON matrix of finite numbers, up to 12 × 12.');return a}
 function vector(raw){const a=JSON.parse(raw);if(!Array.isArray(a)||!a.length||a.length>1000||a.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('Use a JSON vector of finite numbers, such as [1,2,3].');return a}
 if(['symbolic','equations','polynomials','derivatives','integrals'].includes(d.task)){
  if(typeof nerdamer==='undefined')importScripts('./vendor-nerdamer.js');
  const variable=d.variable||'x';if(!/^[a-zA-Z]$/.test(variable))throw Error('Use a single letter for the variable.');
  if(!expression.trim())throw Error('Enter an expression.');let value;
  if(d.task==='symbolic'){if(d.operation==='expand')value=nerdamer(expression).expand().toString();else if(d.operation==='factor')value=nerdamer('factor('+expression+')').toString();else value=nerdamer('simplify('+expression+')').toString()}
  if(d.task==='equations'){value=nerdamer.solveEquations(expression,variable);value=value.length?value.map(x=>String(x)).join(', '):'No solutions returned by this solver. This does not prove there are none.'}
  if(d.task==='polynomials'){const factor=nerdamer('factor('+expression+')').toString(),expanded=nerdamer(expression).expand().toString(),roots=nerdamer('roots('+expression+','+variable+')').text('decimals',14);return lines(['Expanded',expanded],['Factored',factor],['Roots (numerical)',roots])}
  if(d.task==='derivatives'){const order=finite(d.order,'Order');if(!Number.isInteger(order)||order<1||order>8)throw Error('Derivative order must be 1–8.');value=nerdamer.diff(expression,variable,order).toString()}
  if(d.task==='integrals'){
   const anti=nerdamer.integrate(expression,variable).toString();
   if(d.operation==='definite'){
    const a=finite(d.lower,'Lower bound'),b=finite(d.upper,'Upper bound');
    // Composite Simpson estimate with a second grid for a convergence check.
    const f=math.compile(expression),evaluate=x=>{const y=f.evaluate({[variable]:x});if(typeof y!=='number'||!Number.isFinite(y))throw Error('Integral encountered a non-finite or complex value. Check for singularities.');return y};
    const simpson=n=>{const h=(b-a)/n;let sum=evaluate(a)+evaluate(b);for(let i=1;i<n;i++)sum+=(i%2?4:2)*evaluate(a+h*i);return sum*h/3};
    const coarse=simpson(1000),fine=simpson(2000);if(!Number.isFinite(fine))throw Error('Integral overflowed.');return lines(['Antiderivative',anti+' + C'],['Definite integral (numerical)',fine],['Grid difference / 15 (heuristic error)',Math.abs(fine-coarse)/15],['Note','Check convergence and singularities; this is not a rigorous error bound.'])
   }value=anti+(anti.includes('integrate(')?' (symbolic integration unavailable for this expression)':' + C');
  }
  return {result:String(value)};
 }
 if(d.task==='matrices'){
  const a=matrix(d.a);let out;
  if(d.operation==='add')out=math.add(a,matrix(d.b));
  if(d.operation==='multiply')out=math.multiply(a,matrix(d.b));
  if(d.operation==='det')out=math.det(a);
  if(d.operation==='inverse')out=math.inv(a);
  if(d.operation==='transpose')out=math.transpose(a);
  if(d.operation==='solve')out=math.lusolve(a,matrix(d.b));
  if(d.operation==='qr'){const q=math.qr(a);return lines(['Q',q.Q],['R',q.R])}
  if(out===undefined)throw Error('Choose a matrix operation.');return {result:fmt(out)};
 }
 if(d.task==='vectors'){
  const a=vector(d.a),b=['norm','unit'].includes(d.operation)?null:vector(d.b),norm=math.norm(a);
  if(b&&a.length!==b.length)throw Error('Vectors must have the same dimension.');
  if(d.operation==='dot')return lines(['Dot product',math.dot(a,b)]);
  if(d.operation==='cross')return lines(['Cross product',math.cross(a,b)]);
  if(d.operation==='norm')return lines(['Magnitude',norm]);
  if(d.operation==='unit'){if(!norm)throw Error('Zero vector has no unit direction.');return lines(['Unit vector',math.divide(a,norm)])}
  if(d.operation==='angle'){const denom=norm*math.norm(b);if(!denom)throw Error('Angle needs two nonzero vectors.');const theta=Math.acos(Math.max(-1,Math.min(1,math.dot(a,b)/denom)));return lines(['Angle (radians)',theta],['Angle (degrees)',theta*180/Math.PI])}
  if(d.operation==='projection'){const n=math.dot(b,b);if(!n)throw Error('Cannot project onto a zero vector.');return lines(['Projection of a onto b',math.multiply(math.dot(a,b)/n,b)])}
 }
 if(d.task==='ode'){
  const x0=finite(d.x0,'Initial x'),y0=finite(d.y0,'Initial y'),end=finite(d.end,'End x'),n=finite(d.steps,'Steps');if(!Number.isInteger(n)||n<10||n>1000)throw Error('Use 10–1,000 steps.');if(end===x0)throw Error('End x must differ from initial x.');
  const f=math.compile(expression),fn=(x,y)=>{const v=f.evaluate({x,y});if(typeof v!=='number'||!Number.isFinite(v))throw Error('Solution diverged or reached an undefined value. Try a shorter interval.');return v},h=(end-x0)/n,points=[[x0,y0]];let x=x0,y=y0;
  for(let i=0;i<n;i++){const k1=fn(x,y),k2=fn(x+h/2,y+h*k1/2),k3=fn(x+h/2,y+h*k2/2),k4=fn(x+h,y+h*k3);y+=h*(k1+2*k2+2*k3+k4)/6;x=x0+(i+1)*h;if(!Number.isFinite(y))throw Error('Solution overflowed.');points.push([x,y])}
  return {result:`y(${fmt(end)}) ≈ ${fmt(y)}\nRK4 with ${n} steps. Numerical approximation; repeat with more steps to check convergence.`,points};
 }
 if(d.task==='relation'){
  const min=finite(d.min),max=finite(d.max),lo=finite(d.lo),hi=finite(d.hi);if(max<=min||hi<=lo)throw Error('Each maximum must exceed its minimum.');
  const sides=expression.split('=');if(sides.length>2)throw Error('Use one equality, such as x^2+y^2=25.');const f=math.compile(sides.length===2?'('+sides[0]+')-('+sides[1]+')':expression),nx=150,ny=120,grid=[];
  for(let j=0;j<=ny;j++){const row=[];for(let i=0;i<=nx;i++){let z;try{z=f.evaluate({x:min+(max-min)*i/nx,y:lo+(hi-lo)*j/ny})}catch{}row.push(typeof z==='number'&&Number.isFinite(z)?z:null)}grid.push(row)}
  return {grid,min,max,lo,hi};
 }
 if(d.task==='regression'){
  const rows=String(d.data||'').trim().split(/\n|;/).filter(Boolean).map(r=>r.trim().split(/[\s,]+/).map(Number));const degree=d.operation==='quadratic'?2:1,exp=d.operation==='exponential';
  if(rows.length<degree+1||rows.length>1000||rows.some(r=>r.length!==2||r.some(x=>!Number.isFinite(x))))throw Error(`Enter ${degree+1}–1,000 rows, each containing x,y.`);
  if(exp&&rows.some(r=>r[1]<=0))throw Error('Exponential fitting requires positive y values.');
  const xs=rows.map(r=>r[0]),ys=rows.map(r=>exp?Math.log(r[1]):r[1]),center=math.mean(xs),scale=Math.max(...xs.map(x=>Math.abs(x-center)));if(!scale)throw Error('Use at least two distinct x values.');
  const X=xs.map(x=>Array.from({length:degree+1},(_,i)=>((x-center)/scale)**i)),T=math.transpose(X),a=math.lusolve(math.multiply(T,X),math.multiply(T,ys)).map(r=>r[0]);
  const c2=degree===2?a[2]/scale**2:0,c1=a[1]/scale-2*c2*center,c0=a[0]-a[1]*center/scale+c2*center**2;
  const predict=x=>exp?Math.exp(c0+c1*x):c0+c1*x+c2*x*x,mean=math.mean(rows.map(r=>r[1])),sse=rows.reduce((s,[x,y])=>s+(y-predict(x))**2,0),sst=rows.reduce((s,[,y])=>s+(y-mean)**2,0),equation=exp?`y ≈ ${fmt(Math.exp(c0))} × exp(${fmt(c1)} × x)`:`y ≈ ${fmt(c0)} + (${fmt(c1)})x`+(degree===2?` + (${fmt(c2)})x²`:'');
  return lines(['Best fit',equation],['R² (original y scale)',sst?1-sse/sst:'Undefined for constant y'],['RMSE',Math.sqrt(sse/rows.length)],['Points',rows.length],['Method',exp?'Least squares on ln(y)':'Least squares with scaled x']);
 }
 if(d.task==='complex'){
  const z=math.evaluate(expression);if(typeof z!=='number'&&!math.isComplex(z))throw Error('Enter a scalar complex expression.');const c=math.complex(z);return lines(['Rectangular',c],['Real part',c.re],['Imaginary part',c.im],['Magnitude',math.abs(c)],['Argument (radians)',math.arg(c)],['Conjugate',math.conj(c)]);
 }
 if(d.task==='precision'){
  const digits=finite(d.digits,'Precision');if(!Number.isInteger(digits)||digits<16||digits>100)throw Error('Choose 16–100 significant digits.');math.config({number:'BigNumber',precision:digits});return {result:math.format(math.evaluate(expression),{precision:digits}),note:`${digits} significant digits. BigNumber arithmetic; not every function supports it.`};
 }
 throw Error('Unknown calculator mode.');
}
