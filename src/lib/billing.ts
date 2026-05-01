import NativePurchases, { PURCHASE_TYPE } from '@capgo/native-purchases';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

export const initBilling = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await NativePurchases.setup({ apiKey: '' });
    console.log('Billing ready');
  } catch (e) {
    console.error('Billing init failed', e);
  }
};

export const handlePurchase = async (productId: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    toast.success('☕ Thank you! (Test mode)');
    return;
  }
  try {
    const transaction = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.INAPP,
    });
    if (transaction) {
      toast.success('☕ Thank you! You keep FitLog X alive! 💪');
    }
  } catch (e: any) {
    if (e?.code !== 'USERCANCELLED') {
      console.error('Purchase error', e);
      toast.error('Something went wrong. Please try again.');
    }
  }
};
