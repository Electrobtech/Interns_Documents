'use client';

// Lazily injects Razorpay's Checkout.js (their hosted payment sheet) once
// per page load. Not an npm package — Razorpay requires it be loaded from
// their CDN so the checkout iframe itself is always served fresh by them.
let checkoutScriptPromise = null;
export function loadRazorpayCheckout() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!checkoutScriptPromise) {
    checkoutScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(window.Razorpay);
      script.onerror = () => reject(new Error('Could not load Razorpay checkout script'));
      document.body.appendChild(script);
    });
  }
  return checkoutScriptPromise;
}

export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

// Opens the Razorpay Checkout sheet for a { keyId, orderId, amount, currency }
// payload returned by any of billing-service's "create order" endpoints.
// Resolves with { orderId, paymentId, signature } on success, rejects if
// the user closes the sheet or payment fails.
export async function openCheckout({ keyId, orderId, amount, currency, name, description, prefill }) {
  const Razorpay = await loadRazorpayCheckout();
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: keyId,
      order_id: orderId,
      amount,
      currency,
      name: name || 'Electrobtech Innovations',
      description: description || '',
      prefill: prefill || {},
      theme: { color: '#4f46e5' },
      handler(response) {
        resolve({
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss() {
          reject(new Error('Payment cancelled'));
        },
      },
    });
    rzp.on('payment.failed', (resp) => {
      reject(new Error(resp?.error?.description || 'Payment failed'));
    });
    rzp.open();
  });
}
