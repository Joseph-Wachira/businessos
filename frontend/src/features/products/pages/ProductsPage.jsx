import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listProducts,
  createProduct,
  updateProduct,
  listCategories,
  createCategory,
  deleteCategory,
  recordStockMovement,
} from '../api/productsApi.js';
import { useAuthStore } from '../../auth/authStore.js';

const MOVEMENT_REASONS = ['ADJUSTMENT', 'DAMAGE', 'RETURN', 'OPENING_BALANCE'];

export default function ProductsPage() {
  const activeRole = useAuthStore((s) => s.getActiveRole());
  // Mirrors backend/src/rbac/rolePermissions.js.
  const canManage = activeRole === 'OWNER' || activeRole === 'MANAGER';
  const canAdjustStock = canManage || activeRole === 'INVENTORY_MANAGER';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = () => setReloadToken((t) => t + 1);

  const [categoryName, setCategoryName] = useState('');
  const [form, setForm] = useState({ name: '', sku: '', categoryId: '', costPrice: '', sellingPrice: '' });
  const [saving, setSaving] = useState(false);

  const [movementForm, setMovementForm] = useState({
    productId: '',
    reason: 'ADJUSTMENT',
    quantity: '',
    note: '',
  });
  const [recordingMovement, setRecordingMovement] = useState(false);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const [productsData, categoriesData] = await Promise.all([listProducts(), listCategories()]);
        if (ignore) return;
        setProducts(productsData);
        setCategories(categoriesData);
        setError(null);
      } catch (err) {
        if (!ignore) setError(err.response?.data?.error?.message ?? 'Could not load products');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [reloadToken]);

  async function handleAddCategory(e) {
    e.preventDefault();
    setError(null);
    try {
      await createCategory({ name: categoryName });
      setCategoryName('');
      refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not create category');
    }
  }

  async function handleDeleteCategory(categoryId) {
    setError(null);
    try {
      await deleteCategory(categoryId);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not delete category');
    }
  }

  async function handleCreateProduct(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createProduct({
        name: form.name,
        sku: form.sku || undefined,
        categoryId: form.categoryId || undefined,
        costPrice: form.costPrice === '' ? undefined : Number(form.costPrice),
        sellingPrice: form.sellingPrice === '' ? undefined : Number(form.sellingPrice),
      });
      setForm({ name: '', sku: '', categoryId: '', costPrice: '', sellingPrice: '' });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not create product');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(product) {
    setError(null);
    try {
      await updateProduct(product.id, { status: product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not update product');
    }
  }

  async function handleRecordMovement(e) {
    e.preventDefault();
    setError(null);
    setRecordingMovement(true);
    try {
      await recordStockMovement(movementForm.productId, {
        reason: movementForm.reason,
        quantity: Number(movementForm.quantity),
        note: movementForm.note || undefined,
      });
      setMovementForm({ ...movementForm, quantity: '', note: '' });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not record stock movement');
    } finally {
      setRecordingMovement(false);
    }
  }

  function findCategoryName(categoryId) {
    return categories.find((c) => c.id === categoryId)?.name ?? '—';
  }

  return (
    <div>
      <p>
        <Link to="/">&larr; Back</Link>
      </p>
      <h1>Products</h1>
      {error && <p className="error-text">{error}</p>}

      {canManage && (
        <>
          <h2>Categories</h2>
          <form onSubmit={handleAddCategory}>
            <div className="field">
              <label htmlFor="categoryName">New category</label>
              <input id="categoryName" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required />
            </div>
            <button type="submit">Add category</button>
          </form>
          <ul>
            {categories.map((c) => (
              <li key={c.id}>
                {c.name} <button onClick={() => handleDeleteCategory(c.id)}>Remove</button>
              </li>
            ))}
          </ul>

          <h2>Add product</h2>
          <form onSubmit={handleCreateProduct}>
            <div className="field">
              <label htmlFor="productName">Name</label>
              <input
                id="productName"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="sku">SKU</label>
              <input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="categoryId">Category</label>
              <select
                id="categoryId"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="costPrice">Cost price</label>
              <input
                id="costPrice"
                type="number"
                step="0.01"
                min="0"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="sellingPrice">Selling price</label>
              <input
                id="sellingPrice"
                type="number"
                step="0.01"
                min="0"
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
              />
            </div>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Add product'}
            </button>
          </form>
        </>
      )}

      {canAdjustStock && products.length > 0 && (
        <>
          <h2>Record stock movement</h2>
          <form onSubmit={handleRecordMovement}>
            <div className="field">
              <label htmlFor="movementProduct">Product</label>
              <select
                id="movementProduct"
                value={movementForm.productId}
                onChange={(e) => setMovementForm({ ...movementForm, productId: e.target.value })}
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
            </div>
            <div className="field">
              <label htmlFor="movementReason">Reason</label>
              <select
                id="movementReason"
                value={movementForm.reason}
                onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
              >
                {MOVEMENT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="movementQuantity">
                Quantity{' '}
                {['DAMAGE', 'RETURN'].includes(movementForm.reason)
                  ? '(positive number — direction is implied by the reason)'
                  : '(use a negative number to decrease stock)'}
              </label>
              <input
                id="movementQuantity"
                type="number"
                step="1"
                value={movementForm.quantity}
                onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="movementNote">Note</label>
              <input
                id="movementNote"
                value={movementForm.note}
                onChange={(e) => setMovementForm({ ...movementForm, note: e.target.value })}
              />
            </div>
            <button type="submit" disabled={recordingMovement || !movementForm.productId}>
              {recordingMovement ? 'Recording...' : 'Record movement'}
            </button>
          </form>
        </>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <h2>Catalog</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Cost</th>
                <th>Selling</th>
                <th>Stock</th>
                <th>Status</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.sku ?? '—'}</td>
                  <td>{findCategoryName(p.categoryId)}</td>
                  <td>{p.costPrice}</td>
                  <td>{p.sellingPrice}</td>
                  <td>{p.currentStock}</td>
                  <td>{p.status}</td>
                  {canManage && (
                    <td>
                      <button onClick={() => handleToggleStatus(p)}>
                        {p.status === 'ACTIVE' ? 'Archive' : 'Restore'}
                      </button>
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
