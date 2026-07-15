import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../src/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  products?: ProductRef[];
}

interface ProductRef {
  _id: string;
  name: string;
  brand: string;
  basePrice: number;
  image: string | null;
}

const SUGGESTIONS = [
  'Show me summer dresses',
  'What are your best-selling items?',
  'Find me something in red',
  'Affordable streetwear options',
  'Formal wear for men',
  'Trending accessories',
];

export default function AIChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hi! I'm DRYP's AI stylist. Ask me anything about our catalog — I can help you find the perfect pieces." },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const data = await apiCall('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (data.message) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.message,
          products: data.products || [],
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message || 'Sorry, I had trouble processing that. Please try again.',
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your connection and try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
      <Text style={[styles.messageText, item.role === 'user' && styles.userMessageText]}>
        {item.content}
      </Text>
      {item.products && item.products.length > 0 && (
        <View style={styles.productChips}>
          {item.products.slice(0, 5).map(p => (
            <Pressable
              key={p._id}
              style={styles.productChip}
              onPress={() => router.push(`/product/${p._id}`)}
            >
              {p.image && (
                <Image source={{ uri: p.image }} style={styles.chipImage} />
              )}
              <View style={styles.chipInfo}>
                <Text style={styles.chipName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.chipBrand}>{p.brand}</Text>
                <Text style={styles.chipPrice}>${p.basePrice}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  const renderSuggestion = (suggestion: string) => (
    <Pressable
      key={suggestion}
      style={styles.suggestionChip}
      onPress={() => {
        setInput(suggestion);
      }}
    >
      <Text style={styles.suggestionText}>{suggestion}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'AI Stylist',
          headerShown: true,
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#1a1a1a',
          headerTitleStyle: { fontFamily: 'Zaloga', fontSize: 28 },
          headerShadowVisible: false,
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {messages.length <= 1 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsLabel}>Try asking:</Text>
            <View style={styles.suggestionsList}>
              {SUGGESTIONS.map(renderSuggestion)}
            </View>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#000" />
                <Text style={styles.loadingText}>Thinking...</Text>
              </View>
            ) : null
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about products..."
            placeholderTextColor="#999"
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            multiline
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || isLoading}
          >
            <Ionicons
              name="send"
              size={20}
              color={input.trim() && !isLoading ? '#fff' : '#ccc'}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  flex: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  userBubble: {
    backgroundColor: '#000',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  messageText: {
    fontFamily: 'Zaloga',
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  loadingText: {
    fontFamily: 'Zaloga',
    fontSize: 14,
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5ea',
  },
  input: {
    flex: 1,
    fontFamily: 'Zaloga',
    fontSize: 16,
    color: '#000',
    backgroundColor: '#f2f2f7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#f2f2f7',
  },
  productChips: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5ea',
    paddingTop: 10,
    gap: 8,
  },
  productChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 10,
    padding: 8,
    gap: 10,
  },
  chipImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  chipInfo: {
    flex: 1,
  },
  chipName: {
    fontFamily: 'Zaloga',
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  chipBrand: {
    fontFamily: 'Zaloga',
    fontSize: 12,
    color: '#aaa',
    marginTop: 1,
  },
  chipPrice: {
    fontFamily: 'Zaloga',
    fontSize: 13,
    color: '#fff',
    marginTop: 2,
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  suggestionsLabel: {
    fontFamily: 'Zaloga',
    fontSize: 13,
    color: '#8e8e93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  suggestionText: {
    fontFamily: 'Zaloga',
    fontSize: 13,
    color: '#1a1a1a',
  },
});
