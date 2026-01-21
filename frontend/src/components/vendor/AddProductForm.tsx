import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  Button,
  View,
  Pressable,
  Image,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../state/auth';
import { apiCall } from '../../lib/api';

const Checkbox = ({ label, value, onValueChange }) => (
  <Pressable style={formStyles.checkboxContainer} onPress={() => onValueChange(!value)}>
    <View style={[formStyles.checkbox, value && formStyles.checkboxChecked]}>
      {value && <Ionicons name="checkmark" size={16} color="white" />}
    </View>
    <Text>{label}</Text>
  </Pressable>
);

export const AddProductForm = ({ visible, onClose, onProductAdded }) => {
    const [product, setProduct] = useState({
      name: '',
      description: '',
      brand: '',
      category: '',
      tags: '',
      basePrice: '',
    });
    
    const [variants, setVariants] = useState([{ color: '', sizes: '', stock: {}, images: [], price: '' }]);
    const [isUploading, setIsUploading] = useState(false);
    const { token } = useAuthStore();
  
    const addVariant = () => {
      setVariants(prev => [...prev, { color: '', sizes: '', stock: {}, images: [], price: '' }]);
    };
  
    const handleVariantImagePick = async (variantIndex) => {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });
  
      if (!result.canceled) {
        setIsUploading(true);
        const uploadedUrls = [];
        for (const asset of result.assets) {
          const formData = new FormData();
          const uriParts = asset.uri.split('.');
          const fileType = uriParts[uriParts.length - 1];
  
          formData.append('image', {
            uri: asset.uri,
            name: `photo.${fileType}`,
            type: `image/${fileType}`,
          });
  
          try {
            const res = await apiCall('/api/upload', {
              method: 'POST',
              body: formData,
              headers: { 
                'Content-Type': 'multipart/form-data',
              },
            });
            if (res.url) {
              uploadedUrls.push(res.url);
            } else {
              Alert.alert('Upload Failed', res.message || 'Could not upload image.');
            }
          } catch (error) {
            Alert.alert('Upload Error', 'An error occurred while uploading.');
          }
        }
        const newVariants = [...variants];
        newVariants[variantIndex].images.push(...uploadedUrls);
        setVariants(newVariants);
        setIsUploading(false);
      }
    };
  
    const handleVariantChange = (index, field, value) => {
      const newVariants = [...variants];
      newVariants[index][field] = value;
      if (field === 'sizes') {
        const sizesArray = value.split(',').map(s => s.trim()).filter(Boolean);
        const newStock = {};
        sizesArray.forEach(size => {
          newStock[size] = newVariants[index].stock[size] || '0';
        });
        newVariants[index].stock = newStock;
      }
      setVariants(newVariants);
    };
    
    const handleStockChange = (variantIndex, size, value) => {
      const newVariants = [...variants];
      newVariants[variantIndex].stock[size] = value;
      setVariants(newVariants);
    };
  
    const handleSubmit = async () => {
      if (variants.length === 0 || variants.some(v => !v.color || !v.sizes)) {
        Alert.alert('Error', 'Please add at least one variant with a color and sizes.');
        return;
      }
  
      const allVariantImages = variants.flatMap(v => v.images);
  
      let productData = {
        ...product,
        basePrice: parseFloat(product.basePrice),
        tags: product.tags.split(',').map(t => t.trim()),
        images: allVariantImages,
        options: [],
        variants: [],
      };
      
      if (productData.sku === '') {
        delete productData.sku;
      }
  
      const allColors = variants.map(v => v.color).filter(Boolean);
      const allSizes = [...new Set(variants.flatMap(v => v.sizes.split(',').map(s => s.trim()).filter(Boolean)))];
      
      if (allColors.length > 0) {
        productData.options.push({ name: 'Color', values: allColors });
      }
      if (allSizes.length > 0) {
        productData.options.push({ name: 'Size', values: allSizes });
      }
  
      variants.forEach(variant => {
        const sizes = variant.sizes.split(',').map(s => s.trim()).filter(Boolean);
        sizes.forEach(size => {
          const newVariant = {
            options: { Color: variant.color, Size: size },
            stock: parseInt(variant.stock[size] || '0', 10),
            price: parseFloat(variant.price || product.basePrice),
            images: variant.images,
          };
          productData.variants.push(newVariant);
        });
      });
  
      const result = await apiCall('/api/products', {
        method: 'POST',
        body: JSON.stringify(productData),
      });
  
      if (result && !result.message) {
        onProductAdded(result);
        onClose();
      } else {
        Alert.alert('Error', result.message || 'Failed to create product.');
      }
    };
  
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={formStyles.container}>
          <ScrollView>
            <Text style={formStyles.title}>Add New Product</Text>
            <TextInput style={formStyles.input} placeholder="Product Name" onChangeText={v => setProduct({...product, name: v})} />
            <TextInput style={formStyles.input} placeholder="Description" onChangeText={v => setProduct({...product, description: v})} multiline />
            <TextInput style={formStyles.input} placeholder="Brand" onChangeText={v => setProduct({...product, brand: v})} />
            <TextInput style={formStyles.input} placeholder="Category" onChangeText={v => setProduct({...product, category: v})} />
            <TextInput style={formStyles.input} placeholder="Tags (comma-separated)" onChangeText={v => setProduct({...product, tags: v})} />
            <TextInput style={formStyles.input} placeholder="Base Price" onChangeText={v => setProduct({...product, basePrice: v})} keyboardType="numeric" />
  
            <Text style={formStyles.title}>Product Variants</Text>
            
            {variants.map((variant, index) => (
              <View key={index} style={formStyles.variantGroup}>
                <Text style={formStyles.subtitle}>Color Variant {index + 1}</Text>
                <TextInput style={formStyles.input} placeholder="Color Name (e.g., Red)" value={variant.color} onChangeText={v => handleVariantChange(index, 'color', v)} />
                <TextInput style={formStyles.input} placeholder="Sizes (comma-separated, e.g., S,M,L)" value={variant.sizes} onChangeText={v => handleVariantChange(index, 'sizes', v)} />
                <TextInput style={formStyles.input} placeholder="Variant Price (e.g., 599.99)" value={variant.price} onChangeText={v => handleVariantChange(index, 'price', v)} keyboardType="numeric" />
                
                <Text style={formStyles.stockTitle}>Stock for each size:</Text>
                {variant.sizes.split(',').map(s => s.trim()).filter(Boolean).map(size => (
                  <View key={size} style={formStyles.stockInputContainer}>
                    <Text style={formStyles.stockLabel}>{size}:</Text>
                    <TextInput style={formStyles.stockInput} placeholder="0" value={variant.stock[size] || ''} onChangeText={v => handleStockChange(index, size, v)} keyboardType="numeric" />
                  </View>
                ))}
  
                <Text style={formStyles.subtitle}>Variant Images</Text>
                <View style={formStyles.imagePreviewContainer}>
                  {variant.images.map((uri, imgIndex) => <Image key={imgIndex} source={{ uri }} style={formStyles.imagePreview} />)}
                </View>
                <Button title="Add Variant Images" onPress={() => handleVariantImagePick(index)} />
              </View>
            ))}
            <Button title="Add Another Color" onPress={addVariant} />
  
            <View style={formStyles.buttonContainer}>
              <Button title="Save Product" onPress={handleSubmit} />
              <Button title="Cancel" onPress={onClose} color="red" />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  const formStyles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    subtitle: { fontSize: 18, fontWeight: '600', marginTop: 20, marginBottom: 10 },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, marginBottom: 10 },
    optionContainer: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    optionInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5 },
    variantContainer: { backgroundColor: '#f9f9f9', padding: 10, borderRadius: 5, marginBottom: 10 },
    variantInput: { borderWidth: 1, borderColor: '#eee', padding: 8, borderRadius: 5, marginTop: 5 },
    buttonContainer: { marginTop: 30, marginBottom: 50, flexDirection: 'row', justifyContent: 'space-around' },
    imagePreviewContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
    imagePreview: { width: 80, height: 80, borderRadius: 5, margin: 5 },
    checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    checkboxChecked: { backgroundColor: '#0275d8', borderColor: '#0275d8' },
    variantGroup: { borderColor: '#eee', borderWidth: 1, borderRadius: 5, padding: 10, marginVertical: 10 },
    stockTitle: { fontWeight: '600', marginVertical: 10 },
    stockInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    stockLabel: { width: 40 },
    stockInput: { flex: 1, borderWidth: 1, borderColor: '#eee', padding: 8, borderRadius: 5 },
  });
