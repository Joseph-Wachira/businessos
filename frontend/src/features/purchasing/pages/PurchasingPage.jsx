import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listSuppliers,
  createSupplier,
  listPurchases,
  createPurchase,
  receivePurchase,
  cancelPurchase,
} from '../api/purchasingApi.js';
import { listProducts } from '../../products/api/productsApi.js';
import { useAuthStore } from '../../auth/authStore.js';

const emptyItem = () => ({ productId: '', quantity: '1', unitCost: '0' });

export default function PurchasingPage() {
  const activeRole = useAuthStore((s) => s.getActiveRole());
  // Mirrors backend/src/rbac/rolePermissions.js.
  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER' || activeRole === 'INVENTORY_MANAGER';

  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = () => setReloadToken((t) => t + 1);

  const [supplierName, setSupplierName] = useState('');
  const [purchaseSupplierId, setPurchaseSupplierId] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const [suppliersData, purchasesData, productsData] = await Promise.all([
          listSuppliers(),
          listPurchases(),
          listProducts(),
        ]);
        if (ignore) return;
        setSuppliers(suppliersData);
        setPurchases(purchasesData);
        setProducts(productsData);
        setError(null);
      } catch (err) {
        if (!ignore) setError(err.response?.data?.error?.message ?? 'Could not load purchasing data');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [reloadToken]);

  async function handleAddSupplier(e) {
    e.preventDefault();
    setError(null);
    try {
      await createSupplier({ name: supplierName });
      setSupplierName('');
      refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not create supplier');
    }
  }

  function updateItem(index, field, value) {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function handleCreatePurchase(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createPurchase({
        supplierId: purchaseSupplierId,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
        })),
      });
      setPurchaseSupplierId('');
      setItems([emptyItem()]);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not create purchase');
    } finally {
      setSaving(false);
    }
  }

  async function handleReceive(purchaseId) {
    setError(null);
    try {
      await receivePurchase(purchaseId);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not receive purchase');
    }
  }

  async function handleCancel(purchaseId) {
    setError(null);
    try {
      await cancelPurchase(purchaseId);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not cancel purchase');
    }
  }

  return (
    <div>
      <p>
        <Link to="/">&larr; Back</Link>
      </p>
      <h1>Purchasing</h1>
      {error && <p className="error-text">{error}</p>}

      {canManage && (
        <>
          <h2>Suppliers</h2>
          <form onSubmit={handleAddSupplier}>
            <div className="field">
              <label htmlFor="supplierName">New supplier</label>
              <input id="supplierName" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
            </div>
            <button type="submit">Add supplier</button>
          </form>
          <ul>
            {suppliers.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>

          <h2>Create purchase</h2>
          <form onSubmit={handleCreatePurchase}>
            <div className="field">
              <label htmlFor="purchaseSupplier">Supplier</label>
              <select
                id="purchaseSupplier"
                value={purchaseSupplierId}
                onChange={(e) => setPurchaseSupplierId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select a supplier
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {items.map((item, index) => (
              <div key={index} className="field">
                <label htmlFor={`item-product-${index}`}>Line {index + 1}</label>
                <select
                  id={`item-product-${index}`}
                  value={item.productId}
                  onChange={(e) => updateItem(index, 'productId', e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select a product
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Quantity"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  required
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit cost"
                  value={item.unitCost}
                  onChange={(e) => updateItem(index, 'unitCost', e.target.value)}
                  required
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))}>
                    Remove line
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setItems([...items, emptyItem()])}>
              Add line
            </button>
            <div>
              <button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Create purchase'}
              </button>
            </div>
          </form>
        </>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <h2>Purchase orders</h2>
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Items</th>
                <th>Status</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td>{purchase.supplier.name}</td>
                  <td>
                    {purchase.items.map((item) => `${item.product.name} x${item.quantity}`).join(', ')}
                  </td>
                  <td>{purchase.status}</td>
                  {canManage && (
                    <td>
                      {purchase.status === 'PENDING' && (
                        <>
                          <button onClick={() => handleReceive(purchase.id)}>Receive</button>{' '}
                          <button onClick={() => handleCancel(purchase.id)}>Cancel</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
