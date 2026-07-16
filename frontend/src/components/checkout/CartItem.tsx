import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { CartItem as CartItemType } from '../../state/cart';
import { resolveImageUri } from '../../utils/imageUri';

interface CartItemProps {
  item: CartItemType;
}

const CartItem: React.FC<CartItemProps> = ({ item }) => {
  return (
    <View style={styles.cartItemContainer}>
      <Image source={{ uri: resolveImageUri(item.image) }} style={styles.cartItemImage} />
      <View style={styles.itemDetails}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemBrand}>{item.brand}</Text>
        <Text style={styles.itemPrice}>₹{item.price.toFixed(2)}</Text>
        <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cartItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cartItemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 10,
  },
  itemDetails: {
    flex: 1,
  },
  itemTitle: {
    fontFamily: 'Zaloga',
    fontSize: 16,
    marginBottom: 4,
  },
  itemBrand: {
    fontFamily: 'Zaloga',
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  itemPrice: {
    fontFamily: 'Zaloga',
    fontSize: 16,
    marginBottom: 4,
  },
  itemQuantity: {
    fontFamily: 'Zaloga',
    fontSize: 14,
  },
});

export default CartItem;
