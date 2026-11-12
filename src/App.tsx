import { useEffect, useMemo, useState } from 'react';
import { api, auth, image } from '@appdeploy/client';
import {
  Activity,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  CircleUserRound,
  ClipboardList,
  CreditCard,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Ruler,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';

type Profile = {
  userId: string;
  name?: string;
  email?: string;
  role: 'customer' | 'vendor' | 'super_admin';
  createdAt?: string;
};
type Product = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  image: string;
  sizes: string[];
  description: string;
  sellerId?: string;
};
type Measurement = {
  id: string;
  createdAt: string;
  values: Record<string, number>;
  confidence: number;
  notes: string;
};
const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    n
  );
const sampleProducts: Product[] = [
  {
    id: 'p1',
    name: 'Tailored linen blazer',
    brand: 'Studio Form',
    category: 'Outerwear',
    price: 89,
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=900',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    description: 'A relaxed, structured layer in breathable linen.',
  },
  {
    id: 'p2',
    name: 'Everyday straight-leg denim',
    brand: 'Northline',
    category: 'Trousers',
    price: 64,
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=900',
    sizes: ['26', '28', '30', '32', '34'],
    description: 'Mid-rise denim with a clean straight leg.',
  },
  {
    id: 'p3',
    name: 'Soft drape midi dress',
    brand: 'Atelier June',
    category: 'Dresses',
    price: 78,
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900',
    sizes: ['XS', 'S', 'M', 'L'],
    description: 'An easy midi dress made for day-to-evening wear.',
  },
  {
    id: 'p4',
    name: 'Essential cotton shirt',
    brand: 'Common Thread',
    category: 'Shirts',
    price: 48,
    image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=900',
    sizes: ['S', 'M', 'L', 'XL'],
    description: 'A crisp everyday shirt with a soft hand feel.',
  },
  {
    id: 'p5',
    name: 'Modern relaxed trousers',
    brand: 'Studio Form',
    category: 'Trousers',
    price: 72,
    image: 'https://images.unsplash.com/photo-1506629905607-d9a8c8e8a3b2?w=900',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    description: 'A versatile tailored trouser with room to move.',
  },
  {
    id: 'p6',
    name: 'Minimal leather tote',
    brand: 'Forma Goods',
    category: 'Accessories',
    price: 95,
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=900',
    sizes: ['One size'],
    description: 'A structured carryall for everyday essentials.',
  },
];

function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>(sampleProducts);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [page, setPage] = useState('home');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [sideImage, setSideImage] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const [stylistPrompt, setStylistPrompt] = useState(
    'Build a smart-casual outfit for a warm day'
  );
  const [stylistResult, setStylistResult] = useState('');
  const [cart, setCart] = useState<Product[]>([]);
  const [vendorForm, setVendorForm] = useState({
    storeName: '',
    description: '',
  });
  const [listing, setListing] = useState({
    name: '',
    brand: '',
    category: 'Clothing',
    price: '50',
    description: '',
    sizes: 'XS, S, M, L, XL',
  });
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await auth.getUser();
        if (!active) return;
        setUser(current);
        if (current) {
          const response = await api.get('/api/me');
          if (!active) return;
          setProfile(response.data.profile);
          setProducts(
            response.data.products?.length
              ? response.data.products
              : sampleProducts
          );
          setMeasurements(response.data.measurements || []);
        }
      } catch (e: any) {
        setNotice(
          e?.message || 'Could not restore your session. Please try again.'
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    const params = new URLSearchParams(window.location.search);
    const paymentState = params.get('paypal');

    if (paymentState === 'cancel') {
      setNotice('PayPal checkout was cancelled. No payment was captured.');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (paymentState !== 'return') return;
    const orderId = params.get('token') || params.get('orderId');
    if (!orderId) {
      setNotice('PayPal returned without an order reference. Please contact support.');
      return;
    }

    let active = true;
    setBusy(true);
    api
      .post('/api/paypal/capture-order', { orderId })
      .then(response => {
        if (!active) return;
        if (response.data.status === 'COMPLETED') {
          setCart([]);
          setNotice('Payment completed successfully. Your order has been confirmed.');
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          setNotice('PayPal has not confirmed the payment yet. Your order is not marked as paid.');
        }
      })
      .catch((e: any) => {
        if (!active) return;
        setNotice(e?.message || 'We could not verify the PayPal payment. Please contact support before trying again.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => {
      active = false;
    };
  }, [loading, user]);

  const filtered = useMemo(
    () =>
      products.filter(p =>
        [p.name, p.brand, p.category]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [products, query]
  );
  const isAdmin = profile?.role === 'super_admin';
  const nav = [
    { id: 'home', label: 'Discover', icon: Search },
    { id: 'scan', label: 'Body scan', icon: Camera },
    { id: 'fit', label: 'My fit profile', icon: Ruler },
    { id: 'stylist', label: 'AI stylist', icon: Sparkles },
    { id: 'wardrobe', label: 'My wardrobe', icon: Heart },
    { id: 'orders', label: 'Orders', icon: Package },
    ...(profile?.role === 'vendor'
      ? [{ id: 'vendor', label: 'Vendor studio', icon: Store }]
      : []),
    ...(isAdmin
      ? [{ id: 'admin', label: 'Platform admin', icon: ShieldCheck }]
      : []),
  ];
  const go = (id: string) => {
    setPage(id);
    setMobileMenu(false);
    setNotice('');
  };

  async function signIn() {
    try {
      await auth.signInWithRedirect();
    } catch (e: any) {
      setNotice(
        e?.message ||
          'Sign-in could not start. Check browser storage and try again.'
      );
    }
  }
  async function signOut() {
    await auth.signOut();
    setUser(null);
    setProfile(null);
    setMeasurements([]);
    setPage('home');
  }
  async function submitScan() {
    if (!frontImage || !sideImage) {
      setNotice('Add both a front and side image to continue.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const front = await image.resizeIfNeeded(frontImage);
      const side = await image.resizeIfNeeded(sideImage);
      const result = await api.post('/api/scan/estimate', { front, side });
      setScanResult(result.data);
      setMeasurements(prev => [result.data.measurement, ...prev]);
      setNotice(
        'Your estimate is ready. Review each value and correct anything that looks wrong.'
      );
    } catch (e: any) {
      setNotice(
        e?.message ||
          'The scan could not be processed. Try clearer, full-length images.'
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveMeasurements() {
    if (!scanResult) return;
    setBusy(true);
    try {
      const values = scanResult.measurement.values;
      const result = await api.post('/api/measurements', {
        values,
        confidence: scanResult.measurement.confidence,
        notes: scanResult.measurement.notes,
      });
      setMeasurements(prev => [
        result.data.measurement,
        ...prev.filter(m => m.id !== result.data.measurement.id),
      ]);
      setNotice('Your fit profile has been saved.');
      setPage('fit');
    } catch (e: any) {
      setNotice(e?.message || 'Could not save your fit profile.');
    } finally {
      setBusy(false);
    }
  }
  async function askStylist() {
    setBusy(true);
    setStylistResult('');
    try {
      const r = await api.post('/api/stylist', { request: stylistPrompt });
      setStylistResult(r.data.recommendation);
    } catch (e: any) {
      setNotice(e?.message || 'The stylist is unavailable right now.');
    } finally {
      setBusy(false);
    }
  }
  async function becomeVendor(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/api/vendor/apply', vendorForm);
      setProfile(r.data.profile);
      setPage('vendor');
      setNotice('Your vendor workspace is ready.');
    } catch (e: any) {
      setNotice(e?.message || 'Vendor registration failed.');
    } finally {
      setBusy(false);
    }
  }
  async function addListing(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/api/products', {
        ...listing,
        price: Number(listing.price),
        sizes: listing.sizes
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      });
      setProducts(prev => [r.data.product, ...prev]);
      setListing({
        name: '',
        brand: '',
        category: 'Clothing',
        price: '50',
        description: '',
        sizes: 'XS, S, M, L, XL',
      });
      setNotice('Your product listing has been added.');
    } catch (e: any) {
      setNotice(e?.message || 'Could not publish this listing.');
    } finally {
      setBusy(false);
    }
  }
  async function checkout() {
    if (!cart.length) return;
    setBusy(true);
    try {
      const r = await api.post('/api/paypal/create-order', {
        items: cart.map(p => ({
          productId: p.id,
          name: p.name,
          price: p.price,
        })),
      });
      if (r.data.approvalUrl) window.location.assign(r.data.approvalUrl);
      else
        setNotice('PayPal order created, but no approval link was returned.');
    } catch (e: any) {
      setNotice(e?.message || 'PayPal checkout could not be started.');
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className="loading">
        <div className="brand-mark">S</div>
        <p>Preparing your Seerdoon space…</p>
      </div>
    );
  if (!user)
    return (
      <main className="auth-shell">
        <div className="auth-visual">
          <div className="auth-brand">
            <span className="brand-mark">S</span> Seerdoon <i>AI</i>
          </div>
          <div className="auth-copy">
            <p className="eyebrow light">A better fit starts here</p>
            <h1>
              Wear what fits.
              <br />
              <em>Feel like you.</em>
            </h1>
            <p>
              Know your measurements, explore your style and shop with more
              confidence.
            </p>
          </div>
          <div className="auth-foot">
            Personal fit technology · Thoughtful fashion
          </div>
        </div>
        <section className="auth-panel">
          <div className="auth-panel-inner">
            <span className="eyebrow">YOUR PERSONAL FIT SPACE</span>
            <h2>
              Fashion should fit
              <br />
              the person, not the other way around.
            </h2>
            <p>
              Create your Seerdoon space to save your fit profile, get styling
              ideas and shop from independent brands.
            </p>
            <button className="btn primary wide" onClick={signIn}>
              Continue with secure sign-in <ArrowRight size={17} />
            </button>
            <small>
              Sign-in is managed securely by AppDeploy. Your body images are
              used only to process the scan and are not saved by Seerdoon in this
              first release.
            </small>
            <div className="auth-note">
              <ShieldCheck size={16} /> Your measurements stay private to your
              account.
            </div>
            {notice && <p className="notice">{notice}</p>}
          </div>
        </section>
      </main>
    );

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="mobile-toggle"
          onClick={() => setMobileMenu(!mobileMenu)}
        >
          <Menu />
        </button>
        <button className="wordmark" onClick={() => go('home')}>
          <span className="brand-mark">S</span> Seerdoon <i>AI</i>
        </button>
        <div className="top-search">
          <Search size={17} />
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              go('home');
            }}
            placeholder="Find your next favourite…"
          />
        </div>
        <div className="top-actions">
          <button
            className="icon-btn"
            onClick={() => go('wardrobe')}
            aria-label="Wishlist"
          >
            <Heart />
          </button>
          <button className="cart-btn" onClick={() => go('cart')}>
            <ShoppingBag size={18} />
            <span>Bag</span>
            <b>{cart.length}</b>
          </button>
          <button className="avatar" onClick={() => go('fit')}>
            {(profile?.name || profile?.email || 'A').slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>
      <div className="layout">
        <aside className={mobileMenu ? 'sidebar open' : 'sidebar'}>
          <div className="side-label">YOUR SPACE</div>
          {nav.map(item => (
            <button
              key={item.id}
              className={page === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => go(item.id)}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
          <div className="side-divider" />
          <button className="nav-item" onClick={() => go('vendor-join')}>
            <Store size={18} /> Sell on Seerdoon
          </button>
          <div className="side-bottom">
            <div className="account-chip">
              <div className="avatar small">
                {(profile?.name || profile?.email || 'A')
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
              <div>
                <strong>{profile?.name || 'Your account'}</strong>
                <small>
                  {profile?.role === 'vendor'
                    ? 'Vendor account'
                    : 'Customer account'}
                </small>
              </div>
            </div>
            <button className="nav-item muted" onClick={signOut}>
              <LogOut size={17} /> Sign out
            </button>
          </div>
        </aside>
        <main className="main-content">
          {notice && (
            <div className="notice-bar">
              <span>{notice}</span>
              <button onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {page === 'home' && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <span className="eyebrow light">
                    THE FUTURE OF PERSONAL STYLE
                  </span>
                  <h1>
                    Your shape.
                    <br />
                    <em>Your style.</em>
                    <br />
                    Your kind of fit.
                  </h1>
                  <p>
                    Discover pieces that work with your measurements, your
                    wardrobe and the way you like to dress.
                  </p>
                  <div className="hero-buttons">
                    <button
                      className="btn light-btn"
                      onClick={() => go('scan')}
                    >
                      Create my fit profile <ArrowRight size={16} />
                    </button>
                    <button
                      className="text-btn light-text"
                      onClick={() =>
                        document
                          .getElementById('collection')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                    >
                      Explore collection
                    </button>
                  </div>
                </div>
                <div className="hero-art">
                  <div className="hero-ring" />
                  <div className="hero-tag tag-one">
                    <Ruler size={15} /> Fit profile
                  </div>
                  <div className="hero-tag tag-two">
                    <Sparkles size={15} /> Personal style
                  </div>
                  <div className="hero-person">
                    <div className="person-head" />
                    <div className="person-body" />
                    <div className="person-leg left" />
                    <div className="person-leg right" />
                  </div>
                </div>
              </section>
              <section className="feature-strip">
                <div>
                  <Camera />
                  <span>
                    <b>Know your fit</b>
                    <small>Guided body measurement</small>
                  </span>
                </div>
                <div>
                  <WandSparkles />
                  <span>
                    <b>Style with intention</b>
                    <small>AI-powered outfit ideas</small>
                  </span>
                </div>
                <div>
                  <ShoppingBag />
                  <span>
                    <b>Shop with confidence</b>
                    <small>Size-aware product discovery</small>
                  </span>
                </div>
              </section>
              <section className="section" id="collection">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">CURATED FOR YOU</span>
                    <h2>Pieces worth making yours</h2>
                    <p>
                      Explore the Seerdoon marketplace. Product fit suggestions
                      improve when sellers add garment measurements.
                    </p>
                  </div>
                  <button className="underlink" onClick={() => setQuery('')}>
                    View all <ArrowRight size={16} />
                  </button>
                </div>
                <div className="product-grid">
                  {filtered.map(p => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onOpen={() => setSelected(p)}
                      onAdd={() => setCart(c => [...c, p])}
                    />
                  ))}
                </div>
              </section>
              <section className="cta-band">
                <div>
                  <span className="eyebrow light">START WITH YOURSELF</span>
                  <h2>
                    One fit profile.
                    <br />
                    Smarter choices every time.
                  </h2>
                  <p>
                    Build a private measurement profile and use it as a starting
                    point for size guidance.
                  </p>
                </div>
                <button className="btn light-btn" onClick={() => go('scan')}>
                  Start body scan <ArrowRight size={16} />
                </button>
              </section>
            </>
          )}
          {page === 'scan' && (
            <section className="page-section">
              <PageTitle
                eyebrow="YOUR FIT PROFILE"
                title="Let's get your measurements"
                desc="Add clear, full-length front and side photos in fitted clothing. Use a plain background, stand naturally and keep the camera at waist height."
              />
              <div className="scan-layout">
                <div className="scan-card">
                  <div className="scan-step">
                    <span>01</span>
                    <div>
                      <b>Front view</b>
                      <small>
                        Face the camera, arms slightly away from your body.
                      </small>
                    </div>
                  </div>
                  <label className="upload-zone">
                    {frontImage ? (
                      <>
                        <Check />
                        <b>{frontImage.name}</b>
                        <small>Front image selected · click to replace</small>
                      </>
                    ) : (
                      <>
                        <Upload />
                        <b>Upload front image</b>
                        <small>JPG, PNG or WEBP</small>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => setFrontImage(e.target.files?.[0] || null)}
                    />
                  </label>
                  <div className="scan-step">
                    <span>02</span>
                    <div>
                      <b>Side view</b>
                      <small>
                        Turn 90 degrees while keeping your posture relaxed.
                      </small>
                    </div>
                  </div>
                  <label className="upload-zone">
                    {sideImage ? (
                      <>
                        <Check />
                        <b>{sideImage.name}</b>
                        <small>Side image selected · click to replace</small>
                      </>
                    ) : (
                      <>
                        <Upload />
                        <b>Upload side image</b>
                        <small>JPG, PNG or WEBP</small>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => setSideImage(e.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    className="btn primary wide"
                    onClick={submitScan}
                    disabled={busy}
                  >
                    {busy
                      ? 'Estimating measurements…'
                      : 'Estimate my measurements'}{' '}
                    <ArrowRight size={17} />
                  </button>
                  <p className="fine-print">
                    Estimates from photos are not a substitute for a tape
                    measurement. Accuracy depends on camera distance, posture,
                    clothing and a known scale reference. Review and correct all
                    values before relying on a size recommendation.
                  </p>
                </div>
                <div className="scan-guide">
                  <div className="guide-figure">
                    <div className="guide-head" />
                    <div className="guide-torso" />
                    <div className="guide-arms" />
                    <div className="guide-legs" />
                  </div>
                  <h3>Before you begin</h3>
                  <ul>
                    <li>Wear close-fitting clothes.</li>
                    <li>Keep your full body in frame.</li>
                    <li>Use even lighting and a plain background.</li>
                    <li>
                      Keep your phone steady and avoid wide-angle distortion.
                    </li>
                  </ul>
                  <div className="privacy-line">
                    <ShieldCheck /> Images are processed for the estimate and
                    not retained in your Seerdoon profile.
                  </div>
                </div>
              </div>
              {scanResult && (
                <div className="result-card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">ESTIMATED DIMENSIONS</span>
                      <h2>Review your measurements</h2>
                      <p>
                        These are AI estimates, not verified tape measurements.
                      </p>
                    </div>
                    <span className="confidence">
                      {Math.round(scanResult.measurement.confidence || 0)}%
                      confidence
                    </span>
                  </div>
                  <div className="measurement-grid">
                    {Object.entries(scanResult.measurement.values || {}).map(
                      ([key, val]) => (
                        <label key={key}>
                          <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                          <div>
                            <input
                              type="number"
                              step="0.1"
                              value={Number(val)}
                              onChange={e =>
                                setScanResult((s: any) => ({
                                  ...s,
                                  measurement: {
                                    ...s.measurement,
                                    values: {
                                      ...s.measurement.values,
                                      [key]: Number(e.target.value),
                                    },
                                  },
                                }))
                              }
                            />
                            <small>cm</small>
                          </div>
                        </label>
                      )
                    )}
                  </div>
                  <p className="fine-print">{scanResult.measurement.notes}</p>
                  <button
                    className="btn primary"
                    onClick={saveMeasurements}
                    disabled={busy}
                  >
                    Save fit profile <Check size={17} />
                  </button>
                </div>
              )}
            </section>
          )}
          {page === 'fit' && (
            <section className="page-section">
              <PageTitle
                eyebrow="YOUR BODY PROFILE"
                title="A fit reference that moves with you"
                desc="Keep your measurements up to date. Use a tape measure to verify estimates before buying fitted or tailored clothing."
              />
              <div className="fit-overview">
                <div className="avatar-card">
                  <div className="avatar-illustration">
                    <div className="avatar-head" />
                    <div className="avatar-shirt" />
                    <div className="avatar-pants" />
                  </div>
                  <span className="eyebrow">YOUR 3D FIT MODEL</span>
                  <h3>Personal fit avatar</h3>
                  <p>
                    Your visual profile is a simple proportion preview. A
                    calibrated, photorealistic 3D body scan is not available in
                    this release.
                  </p>
                  <span className="status-pill">Profile preview</span>
                </div>
                <div className="fit-data">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">SAVED MEASUREMENTS</span>
                      <h2>Latest fit details</h2>
                    </div>
                    <button className="underlink" onClick={() => go('scan')}>
                      Update scan <ArrowRight size={16} />
                    </button>
                  </div>
                  {measurements.length ? (
                    <>
                      <div className="measurement-grid">
                        {Object.entries(measurements[0].values).map(
                          ([k, v]) => (
                            <div className="measure-tile" key={k}>
                              <span>{k.replace(/([A-Z])/g, ' $1')}</span>
                              <b>
                                {v} <small>cm</small>
                              </b>
                            </div>
                          )
                        )}
                      </div>
                      <p className="fine-print">
                        Last updated{' '}
                        {new Date(measurements[0].createdAt).toLocaleString()} ·
                        Estimate confidence{' '}
                        {Math.round(measurements[0].confidence)}%
                      </p>
                    </>
                  ) : (
                    <div className="empty-state">
                      <Ruler />
                      <h3>Your measurements will appear here</h3>
                      <p>
                        Complete a scan or enter your measurements to start
                        building your fit profile.
                      </p>
                      <button
                        className="btn primary"
                        onClick={() => go('scan')}
                      >
                        Start a body scan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
          {page === 'stylist' && (
            <section className="page-section">
              <PageTitle
                eyebrow="Seerdoon STYLE ASSISTANT"
                title="A stylist that starts with you"
                desc="Describe the occasion, mood or pieces you want to wear. The stylist can use your saved fit profile and the current product catalogue to shape its suggestions."
              />
              <div className="stylist-layout">
                <div className="stylist-card">
                  <div className="stylist-icon">
                    <Sparkles />
                  </div>
                  <h2>What are we dressing for?</h2>
                  <textarea
                    value={stylistPrompt}
                    onChange={e => setStylistPrompt(e.target.value)}
                    rows={4}
                  />
                  <div className="prompt-chips">
                    {[
                      'Workwear, relaxed but polished',
                      'Weekend brunch',
                      'A wedding guest look',
                      'Travel capsule wardrobe',
                    ].map(s => (
                      <button key={s} onClick={() => setStylistPrompt(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn primary"
                    onClick={askStylist}
                    disabled={busy}
                  >
                    {busy ? 'Thinking through your look…' : 'Get styling ideas'}{' '}
                    <Sparkles size={17} />
                  </button>
                </div>
                <div className="stylist-output">
                  {stylistResult ? (
                    <>
                      <span className="eyebrow">YOUR STYLE NOTES</span>
                      <div className="markdown-text">{stylistResult}</div>
                    </>
                  ) : (
                    <div className="empty-state">
                      <WandSparkles />
                      <h3>Your next look starts with an idea</h3>
                      <p>
                        Tell Seerdoon where you're going, what you like and what
                        you want to feel like.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
          {page === 'wardrobe' && (
            <section className="page-section">
              <PageTitle
                eyebrow="YOUR PERSONAL EDIT"
                title="My wardrobe"
                desc="Keep a shortlist of pieces you love and build outfits around them."
              />
              <div className="product-grid">
                {cart.length ? (
                  cart.map((p, i) => (
                    <ProductCard
                      key={p.id + i}
                      product={p}
                      onOpen={() => setSelected(p)}
                      onAdd={() => setCart(c => [...c, p])}
                    />
                  ))
                ) : (
                  <div className="empty-state">
                    <Heart />
                    <h3>Your saved edit is waiting</h3>
                    <p>Add pieces from Discover to start planning outfits.</p>
                    <button className="btn primary" onClick={() => go('home')}>
                      Explore pieces
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
          {page === 'cart' && (
            <section className="page-section">
              <PageTitle
                eyebrow="YOUR BAG"
                title="Ready when you are"
                desc="Review your items before continuing to secure PayPal checkout."
              />
              <div className="cart-layout">
                <div className="cart-list">
                  {cart.length ? (
                    cart.map((p, i) => (
                      <div className="cart-row" key={p.id + i}>
                        <img src={p.image} alt={p.name} />
                        <div>
                          <b>{p.name}</b>
                          <small>{p.brand}</small>
                          <button
                            className="remove-link"
                            onClick={() =>
                              setCart(c => c.filter((_, n) => n !== i))
                            }
                          >
                            Remove
                          </button>
                        </div>
                        <strong>{money(p.price)}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <ShoppingBag />
                      <h3>Your bag is empty</h3>
                      <button
                        className="btn primary"
                        onClick={() => go('home')}
                      >
                        Browse collection
                      </button>
                    </div>
                  )}
                </div>
                {cart.length > 0 && (
                  <aside className="checkout-card">
                    <span className="eyebrow">ORDER SUMMARY</span>
                    <div>
                      <span>Subtotal</span>
                      <b>{money(cart.reduce((a, p) => a + p.price, 0))}</b>
                    </div>
                    <div>
                      <span>Shipping</span>
                      <small>Calculated by seller</small>
                    </div>
                    <div className="total">
                      <span>Estimated total</span>
                      <b>{money(cart.reduce((a, p) => a + p.price, 0))}</b>
                    </div>
                    <button
                      className="btn primary wide"
                      onClick={checkout}
                      disabled={busy}
                    >
                      {busy ? 'Connecting to PayPal…' : 'Continue with PayPal'}{' '}
                      <ArrowRight size={17} />
                    </button>
                    <small>
                      You'll review and approve payment on PayPal. Seller
                      shipping charges may be added separately.
                    </small>
                  </aside>
                )}
              </div>
            </section>
          )}
          {page === 'orders' && (
            <section className="page-section">
              <PageTitle
                eyebrow="YOUR PURCHASES"
                title="Order history"
                desc="Your confirmed orders and payment status will appear here."
              />
              <div className="empty-state">
                <Package />
                <h3>No orders yet</h3>
                <p>
                  When you complete a purchase, its status will be shown here.
                </p>
                <button className="btn primary" onClick={() => go('home')}>
                  Explore marketplace
                </button>
              </div>
            </section>
          )}
          {page === 'vendor-join' && (
            <section className="page-section narrow">
              <PageTitle
                eyebrow="SELL ON Seerdoon"
                title="Bring your collection to the right fit"
                desc="Create a vendor workspace to publish products, add garment size details and manage your catalogue."
              />
              <form className="form-card" onSubmit={becomeVendor}>
                <label>
                  Store name
                  <input
                    required
                    value={vendorForm.storeName}
                    onChange={e =>
                      setVendorForm({
                        ...vendorForm,
                        storeName: e.target.value,
                      })
                    }
                    placeholder="Your brand or store"
                  />
                </label>
                <label>
                  About your store
                  <textarea
                    required
                    value={vendorForm.description}
                    onChange={e =>
                      setVendorForm({
                        ...vendorForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="What do you make or sell?"
                  />
                </label>
                <button className="btn primary" disabled={busy}>
                  Create vendor workspace <ArrowRight size={17} />
                </button>
              </form>
            </section>
          )}
          {page === 'vendor' && (
            <section className="page-section">
              <PageTitle
                eyebrow="VENDOR STUDIO"
                title="Your store, in one place"
                desc="Add products and include garment measurements to support better fit recommendations."
              />
              <div className="vendor-layout">
                <form className="form-card" onSubmit={addListing}>
                  <h3>
                    <Plus /> Add a product
                  </h3>
                  <label>
                    Product name
                    <input
                      required
                      value={listing.name}
                      onChange={e =>
                        setListing({ ...listing, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Brand
                    <input
                      required
                      value={listing.brand}
                      onChange={e =>
                        setListing({ ...listing, brand: e.target.value })
                      }
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Category
                      <input
                        value={listing.category}
                        onChange={e =>
                          setListing({ ...listing, category: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Price (USD)
                      <input
                        type="number"
                        min="1"
                        required
                        value={listing.price}
                        onChange={e =>
                          setListing({ ...listing, price: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Sizes
                    <input
                      value={listing.sizes}
                      onChange={e =>
                        setListing({ ...listing, sizes: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      value={listing.description}
                      onChange={e =>
                        setListing({ ...listing, description: e.target.value })
                      }
                    />
                  </label>
                  <button className="btn primary" disabled={busy}>
                    Publish listing <ArrowRight size={17} />
                  </button>
                </form>
                <div className="vendor-info">
                  <Store />
                  <h3>Help customers choose well</h3>
                  <p>
                    For meaningful fit guidance, add garment-specific chest,
                    waist, hip, shoulder, sleeve and inseam measurements to
                    every listing. Size labels alone are not enough to predict
                    fit.
                  </p>
                  <div className="metric-box">
                    <b>
                      {
                        products.filter(p => p.sellerId === profile?.userId)
                          .length
                      }
                    </b>
                    <span>Your active listings in this session</span>
                  </div>
                </div>
              </div>
            </section>
          )}
          {page === 'admin' && isAdmin && (
            <section className="page-section">
              <PageTitle
                eyebrow="PLATFORM OPERATIONS"
                title="Seerdoon control room"
                desc="Platform overview and catalogue moderation tools."
              />
              <div className="admin-grid">
                <div>
                  <LayoutDashboard />
                  <b>{products.length}</b>
                  <span>Marketplace products loaded</span>
                </div>
                <div>
                  <CircleUserRound />
                  <b>{measurements.length}</b>
                  <span>Your saved fit profiles</span>
                </div>
                <div>
                  <CreditCard />
                  <b>PayPal</b>
                  <span>Checkout integration</span>
                </div>
              </div>
              <p className="fine-print">
                Administrative access is restricted to accounts assigned the
                super-admin role by the platform owner.
              </p>
            </section>
          )}
        </main>
      </div>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="product-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>
              <X />
            </button>
            <img src={selected.image} alt={selected.name} />
            <div>
              <span className="eyebrow">{selected.brand}</span>
              <h2>{selected.name}</h2>
              <b className="modal-price">{money(selected.price)}</b>
              <p>{selected.description}</p>
              <div className="size-note">
                <Ruler /> Size options: {selected.sizes.join(', ')}
              </div>
              <p className="fine-print">
                Fit recommendations are not yet available for this item because
                the seller has not supplied garment-level measurements.
              </p>
              <button
                className="btn primary wide"
                onClick={() => {
                  setCart(c => [...c, selected]);
                  setSelected(null);
                }}
              >
                Add to bag <ShoppingBag size={17} />
              </button>
            </div>
          </div>
        </div>
      )}
      <footer className="footer">
        <span>Seerdoon AI</span>
        <small>
          Personal fit technology for more confident fashion choices.
        </small>
        <small>
          AI measurement estimates require user review. Product availability and
          seller details may vary.
        </small>
      </footer>
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="page-title">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{desc}</p>
    </div>
  );
}
function ProductCard({
  product,
  onOpen,
  onAdd,
}: {
  product: Product;
  onOpen: () => void;
  onAdd: () => void;
}) {
  return (
    <article className="product-card">
      <button className="product-image" onClick={onOpen}>
        <img src={product.image} alt={product.name} />
        <span className="quick-view">
          Quick view <ArrowRight size={14} />
        </span>
      </button>
      <div className="product-info">
        <small>{product.brand}</small>
        <button className="product-name" onClick={onOpen}>
          {product.name}
        </button>
        <div>
          <b>{money(product.price)}</b>
          <button className="add-icon" onClick={onAdd} aria-label="Add to bag">
            <Plus size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}
export default App;
