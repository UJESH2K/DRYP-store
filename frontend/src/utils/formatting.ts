// All charges go through Razorpay in INR — display must match what's charged.
export const formatPrice = (price: number) => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(price);
  } catch (e) {
    return `₹ ${(price || 0).toFixed(2)}`;
  }
};
