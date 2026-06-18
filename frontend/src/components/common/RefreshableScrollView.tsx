/**
 * RefreshableScrollView — a ScrollView with pull-to-refresh
 * and a `onRefresh` callback. Designed for the main shopper
 * feeds (Home, Search, Wishlist) so users always have a way
 * to manually reload.
 *
 *   <RefreshableScrollView
 *     refreshing={isRefreshing}
 *     onRefresh={reload}
 *   >
 *     ... content ...
 *   </RefreshableScrollView>
 */
import React from 'react';
import { ScrollView, RefreshControl, ScrollViewProps } from 'react-native';

interface Props extends ScrollViewProps {
  refreshing: boolean;
  onRefresh: () => void;
  tintColor?: string;
}

export function RefreshableScrollView({
  refreshing,
  onRefresh,
  tintColor = '#1a1a1a',
  children,
  ...rest
}: Props) {
  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={tintColor}
        />
      }
      {...rest}
    >
      {children}
    </ScrollView>
  );
}