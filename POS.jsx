import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ShoppingCart, Plus, Minus, Trash2, Search, Printer, Download, ReceiptText } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const uid = () => Math.random().toString(36).slice(2,9)
const naira = (n) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(n)
const todayISO = () => new Date().toISOString()

const LS_KEYS = { products: 'sv_pos_products', customers: 'sv_pos_customers', sales: 'sv_pos_sales' }

function useLocalArray(key, seed){
  const [val, setVal] = useState(()=>{ try{ const raw=localStorage.getItem(key); return raw?JSON.parse(raw):seed }catch{return seed} })
  useEffect(()=>{ localStorage.setItem(key, JSON.stringify(val)) },[key,val])
  return [val,setVal]
}

const SEED_PRODUCTS = [
  { id: uid(), name: 'Solar Panel 550W', sku: 'SP-550', price: 125000, stock: 20, category: 'Solar' },
  { id: uid(), name: 'Inverter 3.5kVA', sku: 'INV-35', price: 285000, stock: 4, category: 'Solar' },
  { id: uid(), name: 'Router (Dual Band)', sku: 'RT-DB', price: 38000, stock: 15, category: 'ICT' },
]
const SEED_CUSTOMERS = [ { id: uid(), name: 'Walk-in Customer' } ]

export default function POS(){
  const [products, setProducts] = useLocalArray(LS_KEYS.products, SEED_PRODUCTS)
  const [customers, setCustomers] = useLocalArray(LS_KEYS.customers, SEED_CUSTOMERS)
  const [sales, setSales] = useLocalArray(LS_KEYS.sales, [])

  const [query, setQuery] = useState('')
  const [cart, setCart] = useState([])
  const [customerId, setCustomerId] = useState(customers[0]?.id)
  const [paymentMethod, setPaymentMethod] = useState('cash')

  const filteredProducts = useMemo(()=> products.filter(p => ([p.name,p.sku,p.category].join(' ').toLowerCase()).includes(query.toLowerCase())), [products,query])
  const subtotal = useMemo(()=> cart.reduce((s,i)=>s+i.price*i.qty,0), [cart])

  function addToCart(p){ setCart(prev=>{ const idx = prev.findIndex(x=>x.productId===p.id); if(idx>=0){ const copy=[...prev]; copy[idx].qty+=1; return copy } return [...prev, { productId:p.id, name:p.name, price:p.price, qty:1 }] }) }
  function updateQty(productId, qty){ setCart(prev=> prev.map(i=> i.productId===productId?{...i, qty:Math.max(1, qty)}:i)) }
  function removeFromCart(productId){ setCart(prev=> prev.filter(i=> i.productId!==productId)) }
  function clearCart(){ setCart([]) }

  function performCheckout(){ if(cart.length===0) return; for(const it of cart){ const prod = products.find(p=>p.id===it.productId); if(prod && prod.stock < it.qty){ alert(`Insufficient stock for ${prod.name}`); return } }
    setProducts(prev=> prev.map(p=>{ const it = cart.find(c=>c.productId===p.id); if(!it) return p; return {...p, stock: Math.max(0, p.stock - it.qty)} }))
    const cust = customers.find(c=>c.id===customerId)
    const sale = { id:`SV-${new Date().toISOString().replace(/[-:T.]/g,'').slice(0,14)}-${uid().slice(0,4)}`, date: todayISO(), customerName: cust?.name || 'Walk-in Customer', items: cart, subtotal, total: subtotal, paymentMethod }
    setSales(prev=> [sale, ...prev])
    printReceipt(sale)
    clearCart()
  }

  function printReceipt(sale){ const html = `<html><head><meta charset='utf-8'/><title>Receipt</title><style>body{font-family:Arial,sans-serif;padding:12px}h2{margin:0}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #eee;text-align:left}.right{text-align:right}.muted{color:#666;font-size:12px}</style></head><body><img src='/logo.png' alt='SMARTVIEWS' style='height:50px'/><h2>SMARTVIEWS LTD</h2><div class='muted'>Address:  — replace with your address</div><div class='muted'>TIN:  — replace with TIN</div><div>Receipt: ${sale.id}</div><div>${new Date(sale.date).toLocaleString()}</div><hr/>${sale.items.map(i=>`<div style='display:flex;justify-content:space-between'><div>${i.name} x${i.qty}</div><div>${naira(i.price*i.qty)}</div></div>`).join('')}<hr/><div style='display:flex;justify-content:space-between;font-weight:bold'><div>Total</div><div>${naira(sale.total)}</div></div><p class='muted'>Thank you for your business</p></body></html>`; const w=window.open('','_blank'); if(!w) return; w.document.write(html); w.document.close(); }

  function exportCSV(){ if(sales.length===0) return; const hdr = ['receipt','date','customer','payment','total','items']; const rows = sales.map(s=> [s.id, new Date(s.date).toLocaleString(), s.customerName, s.paymentMethod, s.total, s.items.map(i=>`${i.name} x${i.qty}`).join('; ')] ); const csv = [hdr, ...rows].map(r=> r.map(v=>`"${String(v).replace(/"/g,'\"')}"`).join(',')).join('\n'); const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`smartviews_sales_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url) }

  const last7 = useMemo(()=>{ const map = new Map(); for(let d=6; d>=0; d--){ const dt = new Date(); dt.setDate(dt.getDate()-d); const key = dt.toISOString().slice(0,10); map.set(key,0) } sales.forEach(s=>{ const key = s.date.slice(0,10); if(map.has(key)) map.set(key, (map.get(key)||0)+s.total) }); return Array.from(map.entries()).map(([date,total])=>({date: date.slice(5), total})) }, [sales])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">SMARTVIEWS POS</h1>
          <p className="text-sm text-gray-500">Sales • Inventory</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-3 py-2 border rounded">Export Sales</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="flex gap-2 mb-3">
            <div className="flex items-center border rounded px-2 w-full">
              <Search className="mr-2" />
              <input className="w-full p-2" placeholder="Search products" value={query} onChange={(e)=>setQuery(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredProducts.map(p => (
              <div key={p.id} className="p-3 border rounded flex items-center justify-between">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm text-gray-500">{p.sku} • {p.category}</div>
                  <div className="text-lg font-bold mt-1">{naira(p.price)}</div>
                </div>
                <div>
                  <button onClick={()=>addToCart(p)} className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50" disabled={p.stock===0}><ShoppingCart /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="p-3 border rounded">
            <h3 className="font-semibold">Cart</h3>
            <div className="max-h-64 overflow-auto mt-2">
              {cart.length===0 && <div className="text-sm text-gray-500">Cart is empty</div>}
              {cart.map(i => (
                <div key={i.productId} className="flex items-center justify-between py-2 border-b">
                  <div>
                    <div className="font-medium">{i.name}</div>
                    <div className="text-sm text-gray-500">{naira(i.price)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>updateQty(i.productId, i.qty-1)} className="px-2 py-1 border rounded"><Minus /></button>
                    <div>{i.qty}</div>
                    <button onClick={()=>updateQty(i.productId, i.qty+1)} className="px-2 py-1 border rounded"><Plus /></button>
                    <button onClick={()=>removeFromCart(i.productId)} className="px-2 py-1 border rounded"><Trash2 /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <div className="flex justify-between"><span>Subtotal</span><span>{naira(subtotal)}</span></div>
              <div className="flex gap-2 mt-2">
                <select value={paymentMethod} onChange={(e)=>setPaymentMethod(e.target.value)} className="flex-1 p-2 border rounded">
                  <option value="cash">Cash</option>
                  <option value="pos">POS</option>
                  <option value="transfer">Transfer</option>
                </select>
                <button onClick={performCheckout} className="px-4 py-2 bg-green-600 text-white rounded">Checkout</button>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 border rounded">
            <h4 className="font-semibold">Revenue (7 days)</h4>
            <div style={{height:160}} className="mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(v)=>naira(v)} />
                  <Bar dataKey="total" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
