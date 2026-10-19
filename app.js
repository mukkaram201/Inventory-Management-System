(() => {
  const STORAGE_KEY = "stockroom.products.v1";
  const state = { products: [], filter: "all", search: "", storageReady: true };
  const byId = (id) => document.getElementById(id);
  const rows = byId("product-rows");
  const dialog = byId("product-dialog");
  const form = byId("product-form");
  const toast = byId("toast");
  let toastTimer;

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  function showToast(message, isError = false) {
    toast.textContent = message;
    toast.classList.toggle("is-error", isError);
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  function loadProducts() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.some((product) =>
        !product || typeof product.id !== "string" || typeof product.name !== "string" ||
        typeof product.sku !== "string" || !Number.isFinite(product.price) ||
        !Number.isInteger(product.quantity) || !Number.isInteger(product.threshold)
      )) {
        throw new Error("Saved inventory has an invalid format.");
      }
      state.products = parsed;
    } catch (error) {
      state.storageReady = false;
      showToast(`Could not load saved inventory: ${error.message}`, true);
      byId("add-product-button").disabled = true;
      byId("panel-add-button").disabled = true;
      byId("empty-add-button").disabled = true;
    }
  }

  function saveProducts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.products));
      return true;
    } catch (error) {
      showToast(`Could not save inventory: ${error.message}`, true);
      return false;
    }
  }

  function getStatus(product) {
    if (product.quantity === 0) return { label: "Out of stock", className: "status-out" };
    if (product.quantity <= product.threshold) return { label: "Low stock", className: "status-low" };
    return { label: "In stock", className: "status-good" };
  }

  function formatPrice(price) {
    return `Rs ${price.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function render() {
    const lowStock = state.products.filter((product) => product.quantity <= product.threshold);
    const totalUnits = state.products.reduce((total, product) => total + product.quantity, 0);
    const totalValue = state.products.reduce((total, product) => total + product.price * product.quantity, 0);

    byId("metric-products").textContent = state.products.length.toLocaleString();
    byId("metric-units").textContent = totalUnits.toLocaleString();
    byId("metric-value").textContent = formatPrice(totalValue);
    byId("metric-low-stock").textContent = lowStock.length.toLocaleString();
    byId("nav-low-count").textContent = lowStock.length.toLocaleString();
    byId("product-count").textContent = state.products.length.toLocaleString();

    const visible = state.products
      .filter((product) => {
        const matchesSearch = `${product.name} ${product.sku}`.toLowerCase().includes(state.search);
        const matchesFilter = state.filter === "all" ||
          (state.filter === "low" && product.quantity <= product.threshold) ||
          (state.filter === "out" && product.quantity === 0);
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    rows.replaceChildren();
    for (const product of visible) {
      const status = getStatus(product);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><div class="product-cell"><span class="product-avatar" aria-hidden="true">${escapeHtml(product.name.trim().charAt(0).toUpperCase() || "?")}</span><span class="product-name">${escapeHtml(product.name)}</span></div></td>
        <td><span class="sku-text">${escapeHtml(product.sku)}</span></td>
        <td class="price-cell">${formatPrice(product.price)}</td>
        <td><span class="quantity-cell ${product.quantity === 0 ? "quantity-zero" : ""}">${product.quantity.toLocaleString()}</span><span class="threshold-note">limit ${product.threshold}</span></td>
        <td><span class="status-pill ${status.className}"><span class="status-dot"></span>${status.label}</span></td>
        <td><div class="row-actions">
          <button class="row-action" type="button" data-action="edit" data-id="${escapeHtml(product.id)}" aria-label="Edit ${escapeHtml(product.name)}">Edit</button>
          <button class="row-action row-action-delete" type="button" data-action="delete" data-id="${escapeHtml(product.id)}" aria-label="Delete ${escapeHtml(product.name)}">Delete</button>
        </div></td>`;
      rows.append(row);
    }

    const isEmpty = visible.length === 0;
    byId("empty-state").hidden = !isEmpty;
    rows.closest("table").hidden = isEmpty;
    if (isEmpty) {
      const noProducts = state.products.length === 0;
      const isFiltered = !noProducts && (state.search.length > 0 || state.filter !== "all");
      byId("empty-title").textContent = noProducts ? "Your catalog is ready" : "No matching products";
      byId("empty-description").textContent = noProducts
        ? "Add your first product to start tracking quantities and stock value."
        : "Try a different search or filter to find what you’re looking for.";
      byId("empty-add-button").hidden = !noProducts || !state.storageReady;
      byId("table-summary").textContent = isFiltered ? "No products match this view" : "No products yet";
    } else {
      byId("table-summary").textContent = `Showing ${visible.length} of ${state.products.length} ${state.products.length === 1 ? "product" : "products"}`;
    }
  }

  function resetForm() {
    form.reset();
    byId("product-id").value = "";
    byId("product-threshold").value = "5";
    byId("dialog-title").textContent = "Add a product";
    byId("save-product-button").textContent = "Save product";
    byId("form-error-summary").hidden = true;
    form.querySelectorAll(".field-error").forEach((field) => field.textContent = "");
    form.querySelectorAll("input").forEach((input) => input.removeAttribute("aria-invalid"));
  }

  function openDialog(product = null) {
    if (!state.storageReady) {
      showToast("Inventory is read-only because saved data could not be loaded.", true);
      return;
    }
    resetForm();
    if (product) {
      byId("product-id").value = product.id;
      byId("product-name").value = product.name;
      byId("product-sku").value = product.sku;
      byId("product-price").value = product.price;
      byId("product-quantity").value = product.quantity;
      byId("product-threshold").value = product.threshold;
      byId("dialog-title").textContent = "Edit product";
      byId("save-product-button").textContent = "Save changes";
    }
    dialog.showModal();
    byId("product-name").focus();
  }

  function validateForm() {
    const fields = [
      ["product-name", "name-error", "Enter a product name."],
      ["product-sku", "sku-error", "Enter a SKU."],
      ["product-price", "price-error", "Enter a valid non-negative price."],
      ["product-quantity", "quantity-error", "Enter a whole quantity of zero or more."],
      ["product-threshold", "threshold-error", "Enter a whole low-stock limit of zero or more."]
    ];
    let firstInvalid = null;
    for (const [inputId, errorId, message] of fields) {
      const input = byId(inputId);
      const error = byId(errorId);
      const value = input.value.trim();
      let valid = inputId === "product-name" || inputId === "product-sku"
        ? value.length > 0
        : value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
      if (valid && inputId === "product-price") {
        valid = /^\d+(?:\.\d{1,2})?$/.test(value);
      }
      if (valid && (inputId === "product-quantity" || inputId === "product-threshold")) {
        valid = Number.isInteger(Number(value));
      }
      if (valid && inputId === "product-sku") {
        const sku = value.toUpperCase();
        const currentId = byId("product-id").value;
        valid = !state.products.some((product) => product.sku.toUpperCase() === sku && product.id !== currentId);
        if (!valid) error.textContent = "This SKU is already in use.";
      }
      if (!valid) {
        if (!error.textContent) error.textContent = message;
        input.setAttribute("aria-invalid", "true");
        if (!firstInvalid) firstInvalid = input;
      } else {
        input.removeAttribute("aria-invalid");
        if (!(inputId === "product-sku" && error.textContent === "This SKU is already in use.")) {
          error.textContent = "";
        }
      }
    }
    const summary = byId("form-error-summary");
    summary.textContent = firstInvalid ? "Check the highlighted fields and try again." : "";
    summary.hidden = !firstInvalid;
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function onSubmit(event) {
    event.preventDefault();
    form.querySelectorAll(".field-error").forEach((field) => field.textContent = "");
    if (!validateForm()) return;

    const id = byId("product-id").value;
    const product = {
      id: id || (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      name: byId("product-name").value.trim(),
      sku: byId("product-sku").value.trim().toUpperCase(),
      price: Number(byId("product-price").value),
      quantity: Number(byId("product-quantity").value),
      threshold: Number(byId("product-threshold").value)
    };
    const previous = state.products;
    state.products = id
      ? state.products.map((item) => item.id === id ? product : item)
      : [...state.products, product];
    if (!saveProducts()) {
      state.products = previous;
      return;
    }
    render();
    dialog.close();
    showToast(id ? "Product updated." : "Product added.");
  }

  function onTableAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const product = state.products.find((item) => item.id === button.dataset.id);
    if (!product) return;
    if (button.dataset.action === "edit") {
      openDialog(product);
    } else if (button.dataset.action === "delete" &&
      window.confirm(`Delete "${product.name}" from your inventory?`)) {
      const previous = state.products;
      state.products = state.products.filter((item) => item.id !== product.id);
      if (!saveProducts()) {
        state.products = previous;
        return;
      }
      render();
      showToast("Product deleted.");
    }
  }

  byId("today-label").textContent = new Intl.DateTimeFormat("en", {
    weekday: "short", month: "short", day: "numeric", year: "numeric"
  }).format(new Date());
  loadProducts();
  render();

  byId("add-product-button").addEventListener("click", () => openDialog());
  byId("panel-add-button").addEventListener("click", () => openDialog());
  byId("empty-add-button").addEventListener("click", () => openDialog());
  byId("close-dialog").addEventListener("click", () => dialog.close());
  byId("cancel-dialog").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", onSubmit);
  rows.addEventListener("click", onTableAction);
  byId("product-search").addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    render();
  });
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll(".filter-button").forEach((filterButton) => {
        const selected = filterButton === button;
        filterButton.classList.toggle("is-selected", selected);
        filterButton.setAttribute("aria-pressed", String(selected));
      });
      render();
    });
  });
  function setActiveNav(activeLink) {
    document.querySelectorAll(".nav-link").forEach((link) => {
      const active = link === activeLink;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }
  document.querySelector('.nav-link[href="#overview"]').addEventListener("click", (event) => {
    setActiveNav(event.currentTarget);
    document.querySelector('[data-filter="all"]').click();
  });
  byId("alerts-nav").addEventListener("click", (event) => {
    setActiveNav(event.currentTarget);
    document.querySelector('[data-filter="low"]').click();
  });
  byId("products-nav").addEventListener("click", (event) => {
    setActiveNav(event.currentTarget);
    document.querySelector('[data-filter="all"]').click();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !dialog.open && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      byId("product-search").focus();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
})();
