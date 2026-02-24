import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '../types';

interface VirtualCardProps {
  card: Card;
  variant?: 1 | 2 | 3 | 4;
  isFrozen?: boolean;
}

const { width } = Dimensions.get('window');
export const VIRTUAL_CARD_WIDTH = width - 48;
export const VIRTUAL_CARD_HEIGHT = VIRTUAL_CARD_WIDTH * (227 / 360);

const VARIANT_COLORS: Record<1 | 2 | 3 | 4, [string, string, string]> = {
  1: ['#dce3df', '#c9d1cc', '#b8c3bd'],
  2: ['#e3dfd7', '#d2cbc1', '#c3b9ac'],
  3: ['#d7dfe5', '#c6d1da', '#b4c3cf'],
  4: ['#e3dadd', '#d2c6cb', '#c3b4ba'],
};

export default function VirtualCard({ card, variant = 2, isFrozen = false }: VirtualCardProps) {
  return (
    <View style={[styles.container, isFrozen && styles.frozenContainer]}>
      <LinearGradient
        colors={VARIANT_COLORS[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.14)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientOverlay}
        />

        <View style={styles.cardTop}>
          <Text style={styles.virtualText}>{card.name}</Text>
          <Text style={styles.providerText}>{(card.bank || 'Virtual').slice(0, 10)}</Text>
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.cardName}>
            <Text style={styles.label}>Titular / Final</Text>
            <Text style={styles.cardholderName}>Final {card.last4}</Text>
          </View>
          <View>
            <Text style={styles.balanceLabel}>Disponivel</Text>
            <Text style={styles.balanceValue}>R$ {card.availableLimit?.toFixed(2)}</Text>
          </View>
        </View>

        {isFrozen && (
          <View style={styles.frozenOverlay}>
            <Text style={styles.frozenLabel}>Bloqueado</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: VIRTUAL_CARD_WIDTH,
    height: VIRTUAL_CARD_HEIGHT,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 10,
  },
  frozenContainer: {
    opacity: 0.65,
  },
  background: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
    borderRadius: 10,
    overflow: 'hidden',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  virtualText: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '600',
    color: '#26323a',
    maxWidth: '70%',
  },
  providerText: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#26323a',
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 1,
  },
  cardName: {
    gap: 4,
  },
  label: {
    fontWeight: '500',
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#2f3c45',
  },
  cardholderName: {
    fontSize: 16,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: '#202a31',
  },
  balanceLabel: {
    fontWeight: '500',
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#2f3c45',
    textAlign: 'right',
  },
  balanceValue: {
    fontSize: 14,
    letterSpacing: 0.5,
    fontWeight: '700',
    color: '#202a31',
  },
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  frozenLabel: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    textTransform: 'uppercase',
    fontWeight: '700',
    overflow: 'hidden',
  },
});
