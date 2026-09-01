// @ts-nocheck
import React, { useState } from "react";
import { Search, X, UserPlus, ShoppingCart, ArrowLeft, RotateCcw } from "lucide-react";
import { inputStyle, lbl } from "../utils/helpers";
import { SectionTitle } from "../components/common";
import { CustomerRegistration } from "./CustomerRegistration";

export function PDV({
  device,
  customers = [],
  setCustomers,
  products = [],
  setProducts,
  sellers = [],
  sales = [],
  setSales,
  onSaleCompleted,
  card,
  border,
  subtext,
  accent,
  text
}) {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3333";
  const [step, setStep] = useState("gate"); // "gate", "register", "order"
  const [phoneQuery, setPhoneQuery] = useState("");
  const [foundCustomer, setFoundCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Estado para armazenar a última venda concluída e permitir emissão de comprovante
  const [lastCompletedSale, setLastCompletedSale] = useState(null);

  // Estados do Pedido / Venda
  const [productQuery, setProductQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos produtos");
  const [cart, setCart] = useState([]);
  const [seller, setSeller] = useState(sellers[0]?.name || "Juliana Costa");
  const [paymentMethod, setPaymentMethod] = useState("Pix");
  const [discount, setDiscount] = useState(0);
  const [gender, setGender] = useState("Prefiro não informar");
  const [salesChannel, setSalesChannel] = useState("Loja física");
  const [deliveryType, setDeliveryType] = useState("Retirada");

  const categories = [
    "Todos produtos",
    ...Array.from(new Set(products.map((p) => p.category || "Sem categoria")))
  ];

  const search = () => {
    const match = customers.find(
      (c) =>
        c.phone &&
        c.phone.replace(/\D/g, "").includes(phoneQuery.replace(/\D/g, "")) &&
        phoneQuery.length >= 3
    );
    setFoundCustomer(match || null);
  };

  const saveNewCustomer = async (newCustomerData) => {
    const newCust = {
      id: "c" + Date.now(),
      ...newCustomerData,
      // Garantindo que a data de aniversário seja enviada corretamente
      data_aniversario: newCustomerData.data_aniversario || newCustomerData.birthDate || null,
      cashback: 0
    };

    const token = localStorage.getItem("byse_token");
    const user = JSON.parse(localStorage.getItem("byse_user") || "{}");
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "x-user-id": user.id || localStorage.getItem("userId") || "user_1"
    };

    try {
      await fetch(`${API_URL}/api/clientes`, {
        method: "POST",
        headers,
        body: JSON.stringify(newCust)
      });

      if (typeof setCustomers === "function") {
        setCustomers([...customers, newCust]);
      }
      setSelectedCustomer(newCust);
      setStep("order");
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      alert("Erro ao salvar novo cliente no servidor.");
    }
  };

  const startOrderWithoutCustomer = () => {
    setSelectedCustomer(null);
    setStep("order");
  };

  const startOrderWithFoundCustomer = (cust) => {
    setSelectedCustomer(cust);
    setStep("order");
  };

  const backToGate = () => {
    setStep("gate");
    setPhoneQuery("");
    setFoundCustomer(null);
    setSelectedCustomer(null);
    setCart([]);
    setProductQuery("");
    setLastCompletedSale(null);
    setDiscount(0);
  };

  const addToCart = (prod) => {
    setCart((prev) => {
      const exists = prev.find((item) => item.id === prod.id);
      if (exists) {
        return prev.map((item) =>
          item.id === prod.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...prod, qty: 1 }];
    });
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === "Todos produtos" || p.category === selectedCategory;
    const query = productQuery.toLowerCase();
    const matchesQuery =
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.barcode && p.barcode.toLowerCase().includes(query)) ||
      (p.code && p.code.toLowerCase().includes(query));
    return matchesCategory && matchesQuery;
  });

  const subtotal = cart.reduce((acc, item) => acc + (Number(item.price) || 0) * item.qty, 0);
  const total = Math.max(0, subtotal - Number(discount));

  // Função de comprovante otimizada e mais compacta
  const generateReceiptText = (saleData) => {
    const itemsText = saleData.items
      .map(i => `${i.qty}x ${i.name} - ${(Number(i.price) * i.qty).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`)
      .join("\n");

    return `
-- COMPROVANTE --
Data: ${new Date(saleData.date).toLocaleString("pt-BR")}
Cli: ${saleData.customer_name}
Vend: ${saleData.seller}
--------------------------------
ITENS:
${itemsText}
--------------------------------
Subtotal: ${saleData.subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
Desconto: ${saleData.discount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
TOTAL: ${saleData.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
Pagto: ${saleData.payment_method}
--------------------------------
Obrigado pela preferência!
    `.trim();
  };

  const handlePrintReceipt = (saleData) => {
    const receiptContent = generateReceiptText(saleData);
    const printWindow = window.open("", "_blank", "width=320,height=500");
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Comprovante</title>
            <style>
              body { 
                font-family: monospace; 
                white-space: pre-wrap; 
                padding: 5px; 
                margin: 0;
                font-size: 11px; 
                line-height: 1.2;
              }
            </style>
          </head>
          <body>
            ${receiptContent}
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleDownloadPDF = (saleData) => {
    handlePrintReceipt(saleData);
  };

  const finalizeSale = async () => {
    if (cart.length === 0) {
      alert("O carrinho está vazio!");
      return;
    }

    const newSale = {
      id: `pur_${Date.now()}`,
      customerId: selectedCustomer ? selectedCustomer.id : null,
      customer_name: selectedCustomer ? selectedCustomer.name : "Cliente Geral",
      seller: seller,
      payment_method: paymentMethod,
      discount: Number(discount) || 0,
      total: total,
      subtotal: subtotal,
      gender: gender,
      sales_channel: salesChannel,
      delivery_type: deliveryType,
      items: cart,
      date: new Date().toISOString()
    };

    const token = localStorage.getItem("byse_token");
    const user = JSON.parse(localStorage.getItem("byse_user") || "{}");
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "x-user-id": user.id || localStorage.getItem("userId") || "user_1"
    };

    try {
      const response = await fetch(`${API_URL}/api/sales`, {
        method: "POST",
        headers,
        body: JSON.stringify(newSale)
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar a venda no servidor.");
      }

      if (typeof setSales === "function") {
        setSales([...sales, newSale]);
      }

      if (typeof onSaleCompleted === "function") {
        onSaleCompleted();
      }

      setLastCompletedSale(newSale);

      if (selectedCustomer && selectedCustomer.phone) {
        const telefoneLimpo = selectedCustomer.phone.replace(/\D/g, '');
        if (telefoneLimpo.length >= 10) {
          const nomeCliente = selectedCustomer.name || "Cliente";
          const totalFormatado = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          
          const mensagem = encodeURIComponent(
            `Olá, ${nomeCliente}! Obrigado pela compra de ${totalFormatado} na nossa loja! 🚀 Seu saldo de cashback foi atualizado. Aproveite na próxima visita!`
          );
          
          window.open(`https://wa.me/${telefoneLimpo}?text=${mensagem}`, '_blank');
        }
      }

      alert("Venda finalizada e salva com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao conectar com o servidor para salvar a venda. Verifique se a API está rodando.");
    }
  };

  return (
    <div style={{ padding: device === "desktop" ? 20 : 10 }}>
      {step === "gate" && (
        <div>
          <SectionTitle
            title="PDV — Ponto de Venda"
            sub="Busque um cliente, cadastre ou inicie uma venda rápida"
          />
          <div
            style={{
              background: card,
              border: `1px solid ${border}`,
              borderRadius: 14,
              padding: 20,
              maxWidth: 500
            }}
          >
            <button
              onClick={startOrderWithoutCustomer}
              style={{
                background: accent,
                color: "#fff",
                border: "none",
                padding: "12px",
                borderRadius: 8,
                width: "100%",
                cursor: "pointer",
                fontWeight: "bold",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              <ShoppingCart size={18} /> Venda Rápida (Sem Cadastro)
            </button>

            <div
              style={{
                borderTop: `1px solid ${border}`,
                paddingTop: 15,
                marginBottom: 15
              }}
            ></div>

            <label style={lbl(subtext)}>BUSCAR CLIENTE POR TELEFONE</label>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                value={phoneQuery}
                onChange={(e) => {
                  setPhoneQuery(e.target.value);
                  if (!e.target.value) setFoundCustomer(null);
                }}
                placeholder="(00) 00000-0000"
                style={{ ...inputStyle(border, text), flex: 1 }}
              />
              <button
                onClick={search}
                style={{
                  background: accent,
                  border: "none",
                  borderRadius: 8,
                  padding: "0 15px",
                  cursor: "pointer"
                }}
              >
                <Search size={20} color="#fff" />
              </button>
            </div>

            {foundCustomer && (
              <div
                style={{
                  marginTop: 15,
                  padding: 12,
                  background: `${accent}15`,
                  borderRadius: 8
                }}
              >
                <p>
                  Cliente encontrado:{" "}
                  <strong>{foundCustomer.name}</strong>
                </p>
                <button
                  onClick={() => startOrderWithFoundCustomer(foundCustomer)}
                  style={{
                    ...inputStyle(border, text),
                    cursor: "pointer",
                    marginTop: 8,
                    width: "100%",
                    background: accent,
                    color: "#fff",
                    border: "none"
                  }}
                >
                  Iniciar Pedido com Cliente
                </button>
              </div>
            )}

            {!foundCustomer && phoneQuery.length >= 3 && (
              <p style={{ color: subtext, marginTop: 15 }}>
                Cliente não encontrado.
              </p>
            )}

            <div
              style={{
                marginTop: foundCustomer ? 12 : 20,
                borderTop: `1px solid ${border}`,
                paddingTop: 15
              }}
            >
              <button
                onClick={() => setStep("register")}
                style={{
                  background: "transparent",
                  color: accent,
                  border: `1px solid ${accent}`,
                  padding: 10,
                  borderRadius: 8,
                  width: "100%",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontWeight: "bold"
                }}
              >
                <UserPlus size={18} /> Cadastrar Novo Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "register" && (
        <div>
          <button
            onClick={backToGate}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: text
            }}
          >
            <X size={16} /> Voltar
          </button>
          <CustomerRegistration
            card={card}
            border={border}
            text={text}
            subtext={subtext}
            accent={accent}
            onSave={saveNewCustomer}
          />
        </div>
      )}

      {step === "order" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              device === "desktop" ? "2fr 1fr" : "1fr",
            gap: 20
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 15
              }}
            >
              <button
                onClick={backToGate}
                style={{
                  background: "transparent",
                  border: `1px solid ${border}`,
                  borderRadius: 8,
                  padding: 8,
                  cursor: "pointer",
                  color: text,
                  display: "flex",
                  alignItems: "center",
                  gap: 5
                }}
              >
                <ArrowLeft size={16} /> Trocar cliente
              </button>
              <div
                style={{
                  background: card,
                  border: `1px solid ${border}`,
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 14,
                  color: text
                }}
              >
                Cliente:{" "}
                <strong>
                  {selectedCustomer
                    ? selectedCustomer.name
                    : "Sem cliente"}
                </strong>
              </div>
            </div>

            <div style={{ marginBottom: 15 }}>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <Search
                  size={18}
                  color={subtext}
                  style={{ position: "absolute", left: 12 }}
                />
                <input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Pesquisar produto por nome ou código de barras..."
                  style={{
                    ...inputStyle(border, text),
                    paddingLeft: 38,
                    width: "100%"
                  }}
                />
                {productQuery && (
                  <button
                    onClick={() => setProductQuery("")}
                    style={{
                      position: "absolute",
                      right: 10,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: subtext
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 10,
                marginBottom: 15
              }}
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    background:
                      selectedCategory === cat ? accent : card,
                    color: selectedCategory === cat ? "#fff" : text,
                    border: `1px solid ${border}`,
                    borderRadius: 20,
                    padding: "6px 14px",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    fontSize: 13
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 12
              }}
            >
              {filteredProducts.length === 0 ? (
                <p
                  style={{
                    color: subtext,
                    fontSize: 14,
                    gridColumn: "1 / -1"
                  }}
                >
                  Nenhum produto cadastrado ou encontrado.
                </p>
              ) : (
                filteredProducts.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => addToCart(prod)}
                    style={{
                      background: card,
                      border: `1px solid ${border}`,
                      borderRadius: 10,
                      padding: 15,
                      cursor: "pointer"
                    }}
                  >
                    <p
                      style={{
                        fontWeight: "bold",
                        color: text,
                        fontSize: 14,
                        marginBottom: 4
                      }}
                    >
                      {prod.name}
                    </p>
                    <p
                      style={{
                        color: subtext,
                        fontSize: 11,
                        marginBottom: 8
                      }}
                    >
                      {prod.barcode
                        ? `Cód: ${prod.barcode}`
                        : prod.category}
                    </p>
                    <p
                      style={{
                        color: accent,
                        fontWeight: "600"
                      }}
                    >
                      {Number(prod.price || 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                      })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* PAINEL DO CARRINHO REESTRUTURADO E PADRONIZADO */}
          <div
            style={{
              background: card,
              border: `1px solid ${border}`,
              borderRadius: 14,
              padding: 16,
              height: "fit-content",
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}
          >
            <h3
              style={{
                color: text,
                margin: 0,
                fontSize: 16,
                borderBottom: `1px solid ${border}`,
                paddingBottom: 8
              }}
            >
              Carrinho de Compras
            </h3>

            {cart.length === 0 ? (
              <p style={{ color: subtext, fontSize: 13, margin: "4px 0" }}>
                Nenhum item adicionado.
              </p>
            ) : (
              <div
                style={{
                  maxHeight: 140,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  paddingRight: 4
                }}
              >
                {cart.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      color: text
                    }}
                  >
                    <span>
                      {item.qty}x {item.name}
                    </span>
                    <span style={{ fontWeight: 500 }}>
                      {((Number(item.price) || 0) * item.qty).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Bloco Organizado com selects estilizados utilizando as cores da tela (card, border, text) */}
            <div
              style={{
                background: `${border}15`,
                borderRadius: 10,
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                border: `1px solid ${border}`
              }}
            >
              <div>
                <label style={lbl(subtext)}>Vendedor</label>
                <select
                  value={seller}
                  onChange={(e) => setSeller(e.target.value)}
                  style={{
                    ...inputStyle(border, text),
                    backgroundColor: card,
                    color: text,
                    width: "100%",
                    marginTop: 2
                  }}
                >
                  {sellers.map((s) => (
                    <option key={s.id || s.name} value={s.name} style={{ backgroundColor: card, color: text }}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={lbl(subtext)}>Pagamento</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{
                      ...inputStyle(border, text),
                      backgroundColor: card,
                      color: text,
                      width: "100%",
                      marginTop: 2
                    }}
                  >
                    <option value="Pix" style={{ backgroundColor: card, color: text }}>Pix</option>
                    <option value="Crédito" style={{ backgroundColor: card, color: text }}>Crédito</option>
                    <option value="Crédito parcelado" style={{ backgroundColor: card, color: text }}>Crédito parcelado</option>
                    <option value="Débito" style={{ backgroundColor: card, color: text }}>Débito</option>
                    <option value="Dinheiro" style={{ backgroundColor: card, color: text }}>Dinheiro</option>
                    <option value="Fiado" style={{ backgroundColor: card, color: text }}>Fiado</option>
                  </select>
                </div>

                <div>
                  <label style={lbl(subtext)}>Desconto (R$)</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    style={{
                      ...inputStyle(border, text),
                      backgroundColor: card,
                      color: text,
                      width: "100%",
                      marginTop: 2
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={lbl(subtext)}>Canal</label>
                  <select
                    value={salesChannel}
                    onChange={(e) => setSalesChannel(e.target.value)}
                    style={{
                      ...inputStyle(border, text),
                      backgroundColor: card,
                      color: text,
                      width: "100%",
                      marginTop: 2
                    }}
                  >
                    <option value="Loja física" style={{ backgroundColor: card, color: text }}>Loja física</option>
                    <option value="Instagram" style={{ backgroundColor: card, color: text }}>Instagram</option>
                    <option value="WhatsApp" style={{ backgroundColor: card, color: text }}>WhatsApp</option>
                    <option value="Degustação" style={{ backgroundColor: card, color: text }}>Degustação</option>
                  </select>
                </div>

                <div>
                  <label style={lbl(subtext)}>Entrega</label>
                  <select
                    value={deliveryType}
                    onChange={(e) => setDeliveryType(e.target.value)}
                    style={{
                      ...inputStyle(border, text),
                      backgroundColor: card,
                      color: text,
                      width: "100%",
                      marginTop: 2
                    }}
                  >
                    <option value="Retirada" style={{ backgroundColor: card, color: text }}>Retirada</option>
                    <option value="Delivery" style={{ backgroundColor: card, color: text }}>Delivery</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={lbl(subtext)}>Gênero do Cliente</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  style={{
                    ...inputStyle(border, text),
                    backgroundColor: card,
                    color: text,
                    width: "100%",
                    marginTop: 2
                  }}
                >
                  <option value="Prefiro não informar" style={{ backgroundColor: card, color: text }}>Prefiro não informar</option>
                  <option value="Feminino" style={{ backgroundColor: card, color: text }}>Feminino</option>
                  <option value="Masculino" style={{ backgroundColor: card, color: text }}>Masculino</option>
                </select>
              </div>
            </div>

            {/* Totais do Pedido */}
            <div
              style={{
                borderTop: `1px solid ${border}`,
                paddingTop: 8,
                fontSize: 13,
                color: text,
                display: "flex",
                flexDirection: "column",
                gap: 4
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: subtext }}>Subtotal</span>
                <span>
                  {subtotal.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL"
                  })}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: subtext }}>Desconto</span>
                <span>
                  -{Number(discount).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL"
                  })}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: "bold",
                  fontSize: 16,
                  marginTop: 4,
                  color: accent
                }}
              >
                <span>Total</span>
                <span>
                  {total.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL"
                  })}
                </span>
              </div>
            </div>

            <button
              onClick={finalizeSale}
              style={{
                background: accent,
                color: "#fff",
                border: "none",
                padding: 12,
                borderRadius: 8,
                width: "100%",
                fontWeight: "bold",
                cursor: "pointer",
                marginTop: 4
              }}
            >
              Finalizar venda
            </button>

            {/* Opções de Comprovante e Retorno ao Início após finalizar */}
            {lastCompletedSale && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handlePrintReceipt(lastCompletedSale)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      color: text,
                      border: `1px solid ${border}`,
                      padding: 8,
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: "bold"
                    }}
                  >
                    🖨️ Imprimir
                  </button>
                  <button
                    onClick={() => handleDownloadPDF(lastCompletedSale)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      color: text,
                      border: `1px solid ${border}`,
                      padding: 8,
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: "bold"
                    }}
                  >
                    📄 Gerar PDF
                  </button>
                </div>
                <button
                  onClick={backToGate}
                  style={{
                    background: accent,
                    color: "#fff",
                    border: "none",
                    padding: 10,
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  <RotateCcw size={15} /> Realizar Nova Venda
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}