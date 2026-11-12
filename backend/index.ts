import {
  router,
  json,
  error,
  requireAuth,
  db,
  ai,
  secrets,
} from '@appdeploy/sdk';

type Body = Record<string, unknown>;
const safeText = (value: unknown, max = 300) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const safeNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
const productSeed = [
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
];

async function profileFor(userId: string, email?: string, name?: string) {
  const [existing] = await db.get<Body>('profiles', [userId]);
  if (existing) return existing;
  await db.tx.add('profiles', [
    {
      id: userId,
      userId,
      email: email || '',
      name: name || '',
      role: 'customer',
      createdAt: new Date().toISOString(),
    },
  ]);
  const [created] = await db.get<Body>('profiles', [userId], {
    consistent: true,
  });
  return (
    created || {
      userId,
      email: email || '',
      name: name || '',
      role: 'customer',
    }
  );
}

async function listOwned(table: string, ownerId: string, limit = 50) {
  const result = await db.list<Body>(table, { limit });
  return result.items.filter(item => item.ownerId === ownerId);
}

async function loadProducts() {
  const result = await db.list<Body>('products', { limit: 100 });
  if (!result.items.length) return productSeed;
  return result.items;
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ ok: true, app: 'Seerdoon AI' })],
  'GET /api/me': [
    requireAuth(),
    async ctx => {
      const profile = await profileFor(
        ctx.user!.userId,
        ctx.user!.email,
        ctx.user!.name
      );
      const [measurements, products] = await Promise.all([
        listOwned('measurements', ctx.user!.userId, 50),
        loadProducts(),
      ]);
      return json({ profile, measurements, products });
    },
  ],
  'POST /api/scan/estimate': [
    requireAuth(),
    async ctx => {
      const body = ctx.body as Body;
      const front = body.front as
        | { data?: string; mimeType?: string }
        | undefined;
      const side = body.side as
        | { data?: string; mimeType?: string }
        | undefined;
      if (!front?.data || !side?.data || !front.mimeType || !side.mimeType)
        return error('Please provide both front and side images.', 400);
      if (front.data.length > 5_000_000 || side.data.length > 5_000_000)
        return error(
          'Image payload is too large. Please choose smaller images.',
          413
        );
      const schema = {
        type: 'object',
        properties: {
          values: {
            type: 'object',
            properties: {
              height: { type: 'number' },
              chest: { type: 'number' },
              waist: { type: 'number' },
              hips: { type: 'number' },
              shoulderWidth: { type: 'number' },
              armLength: { type: 'number' },
              inseam: { type: 'number' },
              thigh: { type: 'number' },
              neck: { type: 'number' },
              legLength: { type: 'number' },
            },
            required: [
              'height',
              'chest',
              'waist',
              'hips',
              'shoulderWidth',
              'armLength',
              'inseam',
              'thigh',
              'neck',
              'legLength',
            ],
          },
          confidence: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['values', 'confidence', 'notes'],
      };
      const result = await ai.extract({
        prompt:
          'Assess these two images of the same adult person, one front view and one side view. If a reliable physical scale reference is absent, do not pretend exact centimetre measurements can be recovered. Provide cautious rough estimates in centimetres only when visually plausible, set confidence low (0-35) when there is no calibration reference, and explain the limits. If values cannot be responsibly estimated, return conservative placeholder estimates and clearly tell the user to replace them with tape measurements. Do not infer health, ethnicity or other sensitive traits.',
        images: [
          { data: front.data, mimeType: front.mimeType },
          { data: side.data, mimeType: side.mimeType },
        ],
        schema,
        maxTokens: 700,
        temperature: 0.1,
      });
      const parsed = result.data as {
        values: Record<string, number>;
        confidence: number;
        notes: string;
      };
      const values = Object.fromEntries(
        Object.entries(parsed.values || {}).map(([key, value]) => [
          key,
          Math.max(0, Math.min(300, safeNumber(value) || 0)),
        ])
      );
      const measurement = {
        id: 'draft-' + Date.now(),
        ownerId: ctx.user!.userId,
        createdAt: new Date().toISOString(),
        values,
        confidence: Math.max(
          0,
          Math.min(100, safeNumber(parsed.confidence) || 0)
        ),
        notes: safeText(parsed.notes, 800),
      };
      return json({ measurement });
    },
  ],
  'POST /api/measurements': [
    requireAuth(),
    async ctx => {
      const body = ctx.body as Body;
      const values = body.values as Record<string, unknown>;
      if (!values || typeof values !== 'object')
        return error('Measurement values are required.', 400);
      const clean = Object.fromEntries(
        Object.entries(values)
          .slice(0, 20)
          .map(([key, value]) => [
            key.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40),
            Math.max(0, Math.min(300, safeNumber(value) || 0)),
          ])
      );
      const record = {
        ownerId: ctx.user!.userId,
        values: clean,
        confidence: Math.max(
          0,
          Math.min(100, safeNumber(body.confidence) || 0)
        ),
        notes: safeText(body.notes, 800),
        createdAt: new Date().toISOString(),
      };
      const [id] = await db.add('measurements', [record]);
      if (!id) return error('Could not save the measurement profile.', 500);
      return json({ measurement: { ...record, id } }, 201);
    },
  ],
  'POST /api/stylist': [
    requireAuth(),
    async ctx => {
      const request = safeText((ctx.body as Body)?.request, 1000);
      if (!request) return error('Tell the stylist what you need first.', 400);
      const [profile] = await db.get<Body>('profiles', [ctx.user!.userId]);
      const owned = await listOwned('measurements', ctx.user!.userId, 1);
      const products = await loadProducts();
      const result = await ai.generate({
        system:
          'You are Seerdoon AI, a practical personal fashion stylist. Give grounded outfit advice, avoid body shaming, do not claim exact fit without garment measurements, and do not invent stock or fabric facts. Keep suggestions useful and concise.',
        prompt:
          'Customer request: ' +
          request +
          '\nProfile: ' +
          JSON.stringify({
            name: profile?.name || '',
            measurements: owned[0]?.values || 'No saved measurements',
          }) +
          '\nMarketplace catalogue: ' +
          JSON.stringify(products.slice(0, 12)) +
          '\nSuggest an outfit, explain why it works, and name only catalogue items that genuinely fit the request. Clearly distinguish general styling advice from verified size/fit advice.',
        maxTokens: 650,
        temperature: 0.6,
      });
      return json({ recommendation: result.text });
    },
  ],
  'POST /api/vendor/apply': [
    requireAuth(),
    async ctx => {
      const body = ctx.body as Body;
      const storeName = safeText(body.storeName, 100);
      const description = safeText(body.description, 600);
      if (!storeName || !description)
        return error('Store name and description are required.', 400);
      const [existing] = await db.get<Body>('profiles', [ctx.user!.userId]);
      const profile = {
        ...(existing || {}),
        userId: ctx.user!.userId,
        email: ctx.user!.email || '',
        name: ctx.user!.name || '',
        role: 'vendor',
        storeName,
        storeDescription: description,
        updatedAt: new Date().toISOString(),
      };
      const [ok] = await db.tx.update('profiles', [
        { id: ctx.user!.userId, record: profile },
      ]);
      if (!ok) return error('Could not create the vendor workspace.', 500);
      return json({ profile });
    },
  ],
  'POST /api/products': [
    requireAuth(),
    async ctx => {
      const [profile] = await db.get<Body>('profiles', [ctx.user!.userId]);
      if (profile?.role !== 'vendor' && profile?.role !== 'super_admin')
        return error(
          'Create a vendor workspace before publishing products.',
          403
        );
      const body = ctx.body as Body;
      const name = safeText(body.name, 120);
      const brand = safeText(body.brand, 100);
      const price = safeNumber(body.price);
      if (!name || !brand || !Number.isFinite(price) || price <= 0)
        return error('Enter a product name, brand and valid price.', 400);
      const record = {
        ownerId: ctx.user!.userId,
        name,
        brand,
        price,
        category: safeText(body.category, 80),
        description: safeText(body.description, 600),
        sizes: Array.isArray(body.sizes)
          ? body.sizes.slice(0, 20).map(x => safeText(x, 20))
          : [],
        image:
          'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=900',
        createdAt: new Date().toISOString(),
      };
      const [id] = await db.add('products', [record]);
      if (!id) return error('Product could not be published.', 500);
      return json(
        { product: { ...record, id, sellerId: ctx.user!.userId } },
        201
      );
    },
  ],
  'POST /api/paypal/create-order': [
    requireAuth(),
    async ctx => {
      const body = ctx.body as Body;
      const items = Array.isArray(body.items)
        ? (body.items.slice(0, 20) as Body[])
        : [];
      if (!items.length) return error('Your bag is empty.', 400);

      // Never trust prices or product names supplied by the browser.
      const catalogue = await loadProducts();
      const verifiedItems: Array<{
        productId: string;
        name: string;
        price: number;
      }> = [];
      for (const item of items) {
        const productId = safeText(item.productId, 100);
        const product = catalogue.find(entry => entry.id === productId);
        if (!product)
          return error('A product in your bag is no longer available.', 409);
        const price = safeNumber(product.price);
        const name = safeText(product.name, 120);
        if (!name || !Number.isFinite(price) || price <= 0)
          return error('A product in your bag has invalid catalogue pricing.', 409);
        verifiedItems.push({ productId, name, price });
      }

      const total = verifiedItems.reduce((sum, item) => sum + item.price, 0);
      if (!Number.isFinite(total) || total <= 0 || total > 100000)
        return error('Order total is invalid.', 400);
      const names = await secrets.listSecretNames();
      if (
        !names.includes('PAYPAL_CLIENT_ID') ||
        !names.includes('PAYPAL_CLIENT_SECRET')
      )
        return error('PayPal is not configured yet.', 503);
      const clientId = await secrets.readSecret('PAYPAL_CLIENT_ID');
      const clientSecret = await secrets.readSecret('PAYPAL_CLIENT_SECRET');
      const authValue = Buffer.from(clientId + ':' + clientSecret).toString(
        'base64'
      );
      const tokenResponse = await fetch(
        'https://api-m.sandbox.paypal.com/v1/oauth2/token',
        {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + authValue,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        }
      );
      if (!tokenResponse.ok)
        return error(
          'PayPal authentication failed. Check the configured credentials and account status.',
          502
        );
      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
      };
      const origin =
        safeText(
          ctx.event?.headers?.origin || ctx.event?.headers?.Origin,
          300
        ) || 'https://example.com';
      const orderResponse = await fetch(
        'https://api-m.sandbox.paypal.com/v2/checkout/orders',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + tokenData.access_token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [
              {
                amount: { currency_code: 'USD', value: total.toFixed(2) },
                description: 'Seerdoon AI marketplace order',
              },
            ],
            application_context: {
              brand_name: 'Seerdoon AI',
              user_action: 'PAY_NOW',
              return_url: origin + '/?paypal=return',
              cancel_url: origin + '/?paypal=cancel',
            },
          }),
        }
      );
      if (!orderResponse.ok)
        return error('PayPal could not create this order.', 502);
      const order = (await orderResponse.json()) as {
        id: string;
        links?: Array<{ rel: string; href: string }>;
      };
      const approvalUrl = order.links?.find(
        link => link.rel === 'approve'
      )?.href;
      const record = {
        ownerId: ctx.user!.userId,
        paypalOrderId: order.id,
        amount: total,
        currency: 'USD',
        status: 'created',
        items: verifiedItems,
        createdAt: new Date().toISOString(),
      };
      const [id] = await db.add('orders', [record]);
      if (!id)
        return error(
          'PayPal order was created but the local order record could not be saved. Contact support before retrying.',
          500
        );
      return json({ orderId: order.id, approvalUrl, status: 'created' });
    },
  ],
  'POST /api/paypal/capture-order': [
    requireAuth(),
    async ctx => {
      const orderId = safeText((ctx.body as Body)?.orderId, 80);
      if (!orderId) return error('PayPal order ID is required.', 400);

      const ownedOrders = await listOwned('orders', ctx.user!.userId, 200);
      const localOrder = ownedOrders.find(
        item => item.paypalOrderId === orderId
      );
      if (!localOrder) return error('Order was not found for this account.', 404);
      if (localOrder.status === 'COMPLETED') {
        return json({
          orderId,
          status: 'COMPLETED',
          captureId: localOrder.captureId || null,
          alreadyCaptured: true,
        });
      }

      const names = await secrets.listSecretNames();
      if (
        !names.includes('PAYPAL_CLIENT_ID') ||
        !names.includes('PAYPAL_CLIENT_SECRET')
      )
        return error('PayPal is not configured yet.', 503);
      const clientId = await secrets.readSecret('PAYPAL_CLIENT_ID');
      const clientSecret = await secrets.readSecret('PAYPAL_CLIENT_SECRET');
      const authValue = Buffer.from(clientId + ':' + clientSecret).toString(
        'base64'
      );
      const tokenResponse = await fetch(
        'https://api-m.sandbox.paypal.com/v1/oauth2/token',
        {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + authValue,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        }
      );
      if (!tokenResponse.ok)
        return error('PayPal authentication failed. Check the Sandbox credentials.', 502);
      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
      };
      const captureResponse = await fetch(
        'https://api-m.sandbox.paypal.com/v2/checkout/orders/' +
          encodeURIComponent(orderId) +
          '/capture',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + tokenData.access_token,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': 'seerdoon-' + orderId,
          },
          body: '{}',
        }
      );
      const captureData = (await captureResponse.json().catch(() => ({}))) as {
        id?: string;
        status?: string;
        message?: string;
        name?: string;
        purchase_units?: Array<{
          payments?: {
            captures?: Array<{
              id?: string;
              status?: string;
              amount?: { currency_code?: string; value?: string };
            }>;
          };
        }>;
      };
      if (!captureResponse.ok) {
        return error(
          safeText(captureData.message, 300) ||
            'PayPal could not capture this approved order.',
          502
        );
      }

      const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
      const capturedAmount = Number(capture?.amount?.value);
      if (
        captureData.status !== 'COMPLETED' ||
        capture?.status !== 'COMPLETED' ||
        capture?.amount?.currency_code !== localOrder.currency ||
        !Number.isFinite(capturedAmount) ||
        Math.abs(capturedAmount - safeNumber(localOrder.amount)) > 0.001
      ) {
        return error(
          'PayPal did not confirm a completed capture for the expected amount. The order remains unfulfilled.',
          409
        );
      }

      const { id: localOrderRecordId, ...storedOrder } = localOrder;
      const updatedOrder = {
        ...storedOrder,
        status: 'COMPLETED',
        captureId: capture.id || null,
        capturedAt: new Date().toISOString(),
        paypalStatus: captureData.status,
      };
      const [saved] = await db.tx.update('orders', [
        { id: localOrderRecordId, record: updatedOrder },
      ]);
      if (!saved)
        return error(
          'PayPal confirmed the capture, but the local order status could not be updated. Contact support before retrying.',
          500
        );

      return json({
        orderId,
        status: 'COMPLETED',
        captureId: capture.id || null,
        amount: capturedAmount,
        currency: capture.amount?.currency_code,
      });
    },
  ],

});
