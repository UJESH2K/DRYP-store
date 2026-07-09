import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sendStylistMessageStream } from '../lib/ai-stylist';
import { useAuthStore } from '../state/auth';
import { useWishlistStore } from '../state/wishlist';
import { useCartStore } from '../state/cart';
import { useInteractionStore } from '../state/interactions';
import { mapProductsToItems } from '../utils/productMapping';
import ProductDetailModal from './ProductDetailModal';
import * as ImagePicker from 'expo-image-picker';
import type { Item } from '../types';
import { uploadImage } from '../lib/upload';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AIStylistSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestions?: Item[];
  imageUrl?: string;
}

const STYLIST_CONVERSATION_KEY = 'stylist_conversation_id';
const WELCOME_TEXT = 'Hi, I\'m Zaloga. I can suggest complete looks using your swipes, likes, and the full catalog. What are you looking for?';

const createWelcomeMessages = (): ChatMessage[] => [
  {
    id: 'welcome',
    role: 'assistant',
    text: WELCOME_TEXT,
  },
];

const hasPreferences = (preferences: any) => {
  if (!preferences || typeof preferences !== 'object') return false;
  return ['categories', 'colors', 'brands'].some((key) =>
    Array.isArray(preferences[key]) && preferences[key].length > 0
  );
};

export default function AIStylistSheet({ visible, onClose }: AIStylistSheetProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { items: wishlistItems } = useWishlistStore();
  const { items: cartItems } = useCartStore();
  const { history: interactionHistory } = useInteractionStore();

  const [messages, setMessages] = useState<ChatMessage[]>(createWelcomeMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isProductModalVisible, setIsProductModalVisible] = useState(false);

  const scrollRef = useRef<FlatList>(null);
  const conversationIdRef = useRef<string | null>(null);

  const quickChips = useMemo(() => {
    const chips: string[] = [];

    if (wishlistItems.length > 0) chips.push('Suggest tops for my likes');
    if (cartItems.length > 0) chips.push('Outfit for my cart items');
    if (hasPreferences(user?.preferences)) chips.push('Based on my style prefs');
    if (interactionHistory.some((h: any) => h.action === 'dislike')) chips.push('Avoid what I skipped');

    return chips.length > 0
      ? chips.slice(0, 3)
      : ['Build a casual outfit', 'Find a standout piece', 'Refresh my style'];
  }, [wishlistItems.length, cartItems.length, interactionHistory, user?.preferences]);

  const loadConversation = async () => {
    try {
      const storedId = await AsyncStorage.getItem(STYLIST_CONVERSATION_KEY);
      if (!storedId) {
        conversationIdRef.current = null;
        return;
      }

      setLoadingHistory(true);
      const { apiCall } = require('../lib/api');
      const result = await apiCall(`/api/ai/zaloga/conversations/${storedId}`);

      if (result && Array.isArray(result.messages)) {
        conversationIdRef.current = storedId;
        const historyMessages = result.messages.map((m: any, i: number) => ({
          id: `hist_${i}`,
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: m.content,
          imageUrl: m.imageUrl || undefined,
        }));
        if (historyMessages.length > 0) {
          setMessages(historyMessages);
        } else {
          setMessages(createWelcomeMessages());
        }
      } else {
        conversationIdRef.current = null;
        setMessages(createWelcomeMessages());
        await AsyncStorage.removeItem(STYLIST_CONVERSATION_KEY);
      }
    } catch (e: any) {
      conversationIdRef.current = null;
      await AsyncStorage.removeItem(STYLIST_CONVERSATION_KEY);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadConversation();
    }
  }, [visible]);

  const scrollToBottom = () => {
    if (messages.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  };

  useEffect(() => {
    if (visible) {
      scrollToBottom();
    }
  }, [messages, visible]);

  const getSessionDislikes = () => {
    return Array.from(new Set(interactionHistory
      .filter((h: any) => h.action === 'dislike')
      .map((h: any) => h.itemId)
      .filter(Boolean)))
      .slice(0, 8);
  };

  const openProduct = (productId: string) => {
    setSelectedProductId(productId);
    setIsProductModalVisible(true);
  };

  const closeProduct = () => {
    setIsProductModalVisible(false);
    setSelectedProductId(null);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setAttachedImage(result.assets[0].uri);
    }
  };

  const clearAttachment = () => setAttachedImage(null);

  const startNewConversation = async () => {
    conversationIdRef.current = null;
    setInput('');
    clearAttachment();
    setLoading(false);
    setMessages(createWelcomeMessages());
    await AsyncStorage.removeItem(STYLIST_CONVERSATION_KEY);
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text && !attachedImage) return;

    const currentAttach = attachedImage;
    setInput('');
    clearAttachment();
    setLoading(true);

    let assistantMessageId: string | null = null;

    try {
      let imageUrl: string | undefined;
      if (currentAttach) {
        try {
          imageUrl = await uploadImage(currentAttach);
        } catch {
          const uploadError = new Error('Image upload failed. Try a smaller image or check your connection.');
          uploadError.name = 'ImageUploadError';
          throw uploadError;
        }
      }

      const userMsg: ChatMessage = {
        id: Date.now().toString(36),
        role: 'user',
        text: text || 'Styling ideas for this?',
        imageUrl: imageUrl || undefined,
      };

      assistantMessageId = `${Date.now().toString(36)}_ai`;
      const assistantMsg: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        text: '',
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const disliked = getSessionDislikes();
      const payload = {
        message: text || 'What should I wear with this?',
        imageUrl,
        conversationId: conversationIdRef.current || undefined,
        userContext: disliked.length > 0
          ? { recentSignals: { disliked } }
          : undefined,
      };

      const res = await sendStylistMessageStream(payload, {
        onConversationId: (conversationId) => {
          conversationIdRef.current = conversationId;
          AsyncStorage.setItem(STYLIST_CONVERSATION_KEY, conversationId).catch(() => {});
        },
        onToken: (token) => {
          if (!assistantMessageId || !token) return;
          setMessages((prev) => prev.map((m) =>
            m.id === assistantMessageId ? { ...m, text: `${m.text}${token}` } : m
          ));
        },
      });

      if (res.conversationId) {
        conversationIdRef.current = res.conversationId;
        await AsyncStorage.setItem(STYLIST_CONVERSATION_KEY, res.conversationId);
      }

      setMessages((prev) => prev.map((m) =>
        m.id === assistantMessageId
          ? {
              ...m,
              text: res.text || m.text || 'Here are some ideas.',
              suggestions: res.suggestions?.length ? mapProductsToItems(res.suggestions) : undefined,
            }
          : m
      ));
    } catch (e: any) {
      const errorText = e.name === 'ImageUploadError'
        ? 'Image upload failed. Try a smaller image or check your connection.'
        : (e.message || 'Zaloga hit a snag. Try again.');

      if (assistantMessageId) {
        setMessages((prev) => prev.map((m) =>
          m.id === assistantMessageId ? { ...m, text: errorText } : m
        ));
      } else {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 2).toString(36),
          role: 'assistant',
          text: errorText,
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendQuick = (chip: string) => {
    sendMessage(chip);
  };

  const renderSuggestion = ({ item }: { item: Item }) => (
    <Pressable style={styles.suggCard} onPress={() => openProduct(item.id)}>
      <Image source={{ uri: item.image }} style={styles.suggImg} />
      <Text style={styles.suggBrand} numberOfLines={1}>{item.brand}</Text>
      <Text style={styles.suggTitle} numberOfLines={1}>{item.title}</Text>
    </Pressable>
  );

  const renderMsg = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.userRow : styles.aiRow]}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.msgImg} />}
          {item.text ? (
            <Text style={[styles.msgText, isUser ? styles.userText : styles.aiText]}>{item.text}</Text>
          ) : !isUser ? (
            <ActivityIndicator size="small" />
          ) : null}
          {item.suggestions && item.suggestions.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <FlatList
                data={item.suggestions}
                renderItem={renderSuggestion}
                keyExtractor={(s) => s.id}
                horizontal
                showsHorizontalScrollIndicator={false}
              />
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.sheet, { paddingBottom: insets.bottom }]}
        >
          <SafeAreaView style={{ flex: 1 }}>
            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Zaloga — AI Stylist</Text>
              <View style={styles.headerActions}>
                <Pressable
                  onPress={startNewConversation}
                  disabled={loading || loadingHistory}
                  style={[styles.newButton, (loading || loadingHistory) && styles.disabledAction]}
                  accessibilityLabel="Start new Zaloga conversation"
                >
                  <Ionicons name="add-circle-outline" size={18} color="#1a1a1a" />
                  <Text style={styles.newButtonText}>New</Text>
                </Pressable>
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#000" />
                </Pressable>
              </View>
            </View>

            {/* Messages */}
            <FlatList
              ref={scrollRef}
              data={messages}
              renderItem={renderMsg}
              keyExtractor={(m) => m.id}
              style={styles.messages}
              contentContainerStyle={{ padding: 12 }}
              onContentSizeChange={scrollToBottom}
            />

            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" />
                <Text style={{ marginLeft: 8, color: '#666' }}>Zaloga is styling...</Text>
              </View>
            )}

            {loadingHistory && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" />
                <Text style={{ marginLeft: 8, color: '#666' }}>Loading your style history...</Text>
              </View>
            )}

            {/* Quick chips */}
            {messages.length < 5 && quickChips.length > 0 && (
              <View style={styles.chipsRow}>
                {quickChips.map((c, i) => (
                  <Pressable key={i} style={styles.chip} onPress={() => sendQuick(c)}>
                    <Text style={styles.chipText}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Composer */}
            <View style={styles.composer}>
              {attachedImage && (
                <View style={styles.attachPreview}>
                  <Image source={{ uri: attachedImage }} style={styles.attachThumb} />
                  <Pressable onPress={clearAttachment} style={{ marginLeft: 6 }}>
                    <Ionicons name="close-circle" size={18} color="#f00" />
                  </Pressable>
                </View>
              )}
              <View style={styles.inputRow}>
                <Pressable onPress={pickImage} style={styles.attachBtn}>
                  <Ionicons name="camera-outline" size={22} color="#666" />
                </Pressable>
                <TextInput
                  style={styles.input}
                  placeholder="Ask Zaloga..."
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={() => sendMessage()}
                  returnKeyType="send"
                  multiline
                />
                <Pressable
                  onPress={() => sendMessage()}
                  disabled={loading || (!input.trim() && !attachedImage)}
                  style={styles.sendBtn}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={28}
                    color={loading || (!input.trim() && !attachedImage) ? '#ccc' : '#1a1a1a'}
                  />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>

      {selectedProductId && (
        <ProductDetailModal
          productId={selectedProductId}
          isVisible={isProductModalVisible}
          onClose={closeProduct}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    minHeight: '60%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sheetTitle: { fontFamily: 'Zaloga', fontSize: 20 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  newButtonText: { fontSize: 13, color: '#1a1a1a', fontWeight: '600' },
  closeButton: { padding: 4 },
  disabledAction: { opacity: 0.4 },
  messages: { flex: 1 },
  msgRow: { marginVertical: 4 },
  userRow: { alignItems: 'flex-end' },
  aiRow: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 14 },
  userBubble: { backgroundColor: '#1a1a1a' },
  aiBubble: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0' },
  msgText: { fontSize: 15 },
  userText: { color: '#fff' },
  aiText: { color: '#1a1a1a' },
  msgImg: { width: 140, height: 100, borderRadius: 8, marginBottom: 6 },
  suggCard: { width: 90, marginRight: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee', overflow: 'hidden' },
  suggImg: { width: '100%', height: 70 },
  suggBrand: { fontSize: 10, color: '#888', padding: 4 },
  suggTitle: { fontSize: 11, paddingHorizontal: 4, paddingBottom: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  chip: { backgroundColor: '#f0f0f0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  chipText: { fontSize: 12 },
  composer: { borderTopWidth: 1, borderTopColor: '#e0e0e0', padding: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8', borderRadius: 20, paddingLeft: 8 },
  attachBtn: { padding: 8 },
  input: { flex: 1, padding: 10, fontSize: 15 },
  sendBtn: { padding: 4, marginRight: 4 },
  attachPreview: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  attachThumb: { width: 40, height: 40, borderRadius: 6 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', padding: 8, justifyContent: 'center' },
});
