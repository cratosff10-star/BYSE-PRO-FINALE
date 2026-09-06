import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Phone, 
  MapPin, 
  Instagram, 
  Lock, 
  CheckCircle, 
  AlertCircle, 
  ChevronRight, 
  MessageCircle,
  X,
  Plus,
  Minus
} from 'lucide-react';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  vip_price?: number;
  description: string;
  image_url?: string;
  stock: number;
}

interface StoreConfig {
  storeName: string;
  whatsapp: string;
  address: string;
  instagram?: string;
  bannerUrl?: string;
}

interface CatalogoProps {
  userId?: string;
  apiUrl?: string;
}

export default function CatalogoPublico({ userId, apiUrl }: CatalogoProps) {
  // Define a URL base da API (prioriza a propriedade passada ou fallback para o padrão)
  const API_BASE = apiUrl || (typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [storeData, setStoreData] = useState<StoreConfig>({
    storeName: 'Carregando Loja...',
    whatsapp: '',
    address: ''
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Carrinho e VIP
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isVipUnlocked, setIsVipUnlocked] = useState<boolean>(false);
  const [vipPasswordInput, setVipPasswordInput] = useState<string>('');
  const [showVipModal, setShowVipModal] = useState<boolean>(false);

  // Extrai o userId da URL caso não venha via props (ex: /catalogo/1787335620584)
  const getUserIdFromPath = () => {
    if (userId) return userId;
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/');
      const index = parts.indexOf('catalogo');
      if (index !== -1 && parts[index + 1]) {
        return parts[index + 1];
      }
    }
    return null;
  };

  useEffect(() => {
    const fetchCatalogData = async () => {
      const currentUserId = getUserIdFromPath();
      
      if (!currentUserId) {
        setError('Identificador da loja não encontrado na URL.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Correção aplicada: Utiliza a rota correta da API pública apontando para o backend
        const response = await fetch(`${API_BASE}/public/catalogo/${currentUserId}`);
        
        if (!response.ok) {
          throw new Error('Não foi possível carregar os dados do catálogo desta loja.');
        }

        const data = await response.json();
        
        setStoreData({
          storeName: data.storeName || data.name || 'Loja Parceira',
          whatsapp: data.whatsapp || '',
          address: data.address || '',
          instagram: data.instagram || '',
          bannerUrl: data.bannerUrl || ''
        });

        setProducts(data.products || []);
      } catch (err: any) {
        console.error('Erro ao buscar catálogo:', err);
        setError(err.message || 'Erro de conexão com o servidor.');
      } finally {
        setLoading(false);
      }
    };

    fetchCatalogData();
  }, [userId]);

  // Categorias únicas
  const categories = ['Todos', ...Array.from(new Set(products.map(p => p.category)))];

  // Filtragem de produtos
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'Todos' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Manipulação do Carrinho
  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.product.id === product.id);
      if (existing) {
        return prevCart.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as { product: Product; quantity: number }[];
    });
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => {
      const price = (isVipUnlocked && item.product.vip_price) ? item.product.vip_price : item.product.price;
      return total + (price * item.quantity);
    }, 0);
  };

  const handleCheckoutWhatsApp = () => {
    if (!storeData.whatsapp) {
      alert('Esta loja não configurou um número de WhatsApp para pedidos.');
      return;
    }

    let message = `*Novo Pedido - ${storeData.storeName}*\n\n`;
    if (isVipUnlocked) message += `_Cliente com Acesso VIP Ativo_ 🔓\n\n`;

    cart.forEach(item => {
      const price = (isVipUnlocked && item.product.vip_price) ? item.product.vip_price : item.product.price;
      message += `• ${item.quantity}x ${item.product.name} - R$ ${(price * item.quantity).toFixed(2)}\n`;
    });

    message += `\n*Total:* R$ ${calculateTotal().toFixed(2)}`;

    const encoded = encodeURIComponent(message);
    const cleanPhone = storeData.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="font-medium">Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full text-center border border-gray-100">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Ops! Ocorreu um erro</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-24">
      {/* Header / Banner da Loja */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{storeData.storeName}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
              {storeData.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {storeData.address}
                </span>
              )}
              {storeData.instagram && (
                <span className="flex items-center gap-1">
                  <Instagram className="w-3.5 h-3.5" /> @{storeData.instagram}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowVipModal(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                isVipUnlocked 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              {isVipUnlocked ? 'VIP Ativo' : 'Área VIP'}
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition shadow-sm"
              aria-label="Abrir carrinho"
            >
              <ShoppingBag className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-5xl mx-auto px-4 mt-6">
        {/* Barra de Pesquisa e Filtros */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === category
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Grade de Produtos */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 p-8">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-700">Nenhum produto encontrado</h3>
            <p className="text-xs text-gray-500 mt-1">Tente buscar por outro termo ou categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProducts.map(product => {
              const hasVipPrice = isVipUnlocked && product.vip_price !== undefined && product.vip_price > 0;
              
              return (
                <div key={product.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    {product.image_url ? (
                      <div className="h-48 w-full bg-gray-100 overflow-hidden">
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="w-full h-full object-cover hover:scale-105 transition duration-300"
                        />
                      </div>
                    ) : (
                      <div className="h-32 w-full bg-gray-50 flex items-center justify-center text-gray-300">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                    )}
                    <div className="p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {product.category}
                      </span>
                      <h3 className="font-bold text-gray-800 text-base mt-1.5">{product.name}</h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                    </div>
                  </div>

                  <div className="p-4 pt-0 flex items-center justify-between mt-4">
                    <div>
                      {hasVipPrice ? (
                        <div>
                          <span className="text-xs text-gray-400 line-through">R$ {product.price.toFixed(2)}</span>
                          <p className="text-base font-extrabold text-emerald-600">R$ {product.vip_price?.toFixed(2)} <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded ml-1">VIP</span></p>
                        </div>
                      ) : (
                        <p className="text-base font-extrabold text-gray-900">R$ {product.price.toFixed(2)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => addToCart(product)}
                      className="bg-indigo-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-700 transition shadow-xs"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal / Gaveta do Carrinho */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={() => setIsCartOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-xl flex flex-col">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-600" /> Seu Carrinho
                </h2>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-2 stroke-1" />
                    <p className="text-sm">O carrinho está vazio</p>
                  </div>
                ) : (
                  cart.map(item => {
                    const price = (isVipUnlocked && item.product.vip_price) ? item.product.vip_price : item.product.price;
                    return (
                      <div key={item.product.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex-1 pr-2">
                          <h4 className="font-semibold text-sm text-gray-800">{item.product.name}</h4>
                          <p className="text-xs text-indigo-600 font-medium">R$ {price.toFixed(2)} un</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="w-7 h-7 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="w-7 h-7 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-4 border-t border-gray-100 bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-gray-600 font-medium">Total do Pedido:</span>
                    <span className="text-lg font-black text-gray-900">R$ {calculateTotal().toFixed(2)}</span>
                  </div>
                  <button
                    onClick={handleCheckoutWhatsApp}
                    className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition shadow-sm"
                  >
                    <MessageCircle className="w-5 h-5" /> Enviar Pedido via WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal da Senha VIP */}
      {showVipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-2 text-amber-600">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-gray-800">Acesso Exclusivo VIP</h3>
              <p className="text-xs text-gray-500 mt-1">Insira a senha fornecida pelo lojista para desbloquear preços e produtos especiais.</p>
            </div>

            <input
              type="password"
              placeholder="Senha VIP"
              value={vipPasswordInput}
              onChange={(e) => setVipPasswordInput(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowVipModal(false)}
                className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  // Validação simples de exemplo ou checagem flexível de senha VIP
                  if (vipPasswordInput.trim().length > 0) {
                    setIsVipUnlocked(true);
                    setShowVipModal(false);
                    setVipPasswordInput('');
                  } else {
                    alert('Insira uma senha válida.');
                  }
                }}
                className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-amber-700 transition shadow-sm"
              >
                Desbloquear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}