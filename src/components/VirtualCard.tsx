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
  1: ['#0f2027', '#203a43', '#2c5364'],   // deep ocean
  2: ['#1a0533', '#3b1278', '#6a0dad'],   // royal purple
  3: ['#0d1b2a', '#1b4332', '#2d6a4f'],   // dark emerald
  4: ['#1c0a0a', '#4a1530', '#8b1a4a'],   // deep rose
};

const VARIANT_ACCENT: Record<1 | 2 | 3 | 4, string> = {
  1: '#4fc3f7',
  2: '#ce93d8',
  3: ['#69f0ae'][0],
  4: '#f48fb1',
};

function Chip() {
  return (
    <View style={chipStyles.chip}>
      <View style={chipStyles.row}>
        <View style={chipStyles.cell} />
        <View style={chipStyles.cell} />
      </View>
      <View style={chipStyles.line} />
      <View style={chipStyles.row}>
        <View style={chipStyles.cell} />
        <View style={chipStyles.cell} />
      </View>
    </View>
  );
}

function ContactlessIcon({ color }: { color: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 22, height: 22 }}>
      {[10, 15, 20].map((size, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1.5,
            borderColor: color,
            opacity: 0.7 - i * 0.15,
            borderLeftColor: 'transparent',
            borderBottomColor: 'transparent',
            transform: [{ rotate: '45deg' }],
          }}
        />
      ))}
    </View>
  );
}

function getLimitBarColor(pct: number): string {
  if (pct >= 85) return '#EF4444';
  if (pct >= 55) return '#F59E0B';
  return '#10B981';
}

export default function VirtualCard({ card, variant = 2, isFrozen = false }: VirtualCardProps) {
  const accent = VARIANT_ACCENT[variant];

  const total = card.totalLimit ?? 0;
  const available = card.availableLimit ?? 0;
  const usedPct = total > 0 ? Math.min(((total - available) / total) * 100, 100) : 0;
  const barColor = getLimitBarColor(usedPct);

  return (
    <View style={[styles.container, isFrozen && styles.frozenContainer]}>
      <LinearGradient
        colors={VARIANT_COLORS[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
        {/* Glow blob top-right */}
        <View style={[styles.glowBlob, { backgroundColor: accent }]} />

        {/* Geometric circle decoration */}
        <View style={[styles.circleDecor1, { borderColor: accent }]} />
        <View style={[styles.circleDecor2, { borderColor: accent }]} />

        {/* Shine overlay */}
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.shineOverlay}
        />

        {/* Top row: card name + contactless */}
        <View style={styles.cardTop}>
          <Text style={styles.cardNameText}>{card.name}</Text>
          <ContactlessIcon color={accent} />
        </View>

        {/* Middle: chip */}
        <View style={styles.chipRow}>
          <Chip />
        </View>

        {/* Bottom section: info row + limit bar */}
        <View style={styles.bottomSection}>
          <View style={styles.cardBottom}>
            <View style={styles.cardInfo}>
              <Text style={[styles.label, { color: accent }]}>Titular / Final</Text>
              <Text style={styles.cardholderName}>•••• {card.last4}</Text>
            </View>
            <View style={styles.balanceInfo}>
              <Text style={[styles.label, { color: accent }]}>Disponível</Text>
              <Text style={styles.balanceValue}>R$ {card.availableLimit?.toFixed(2)}</Text>
            </View>
          </View>

          {/* Limit usage bar */}
          <View style={styles.limitBarWrapper}>
            <View style={styles.limitBarTrack}>
              <View style={[styles.limitBarFill, { width: `${usedPct}%` as any, backgroundColor: barColor }]} />
            </View>
            <Text style={[styles.limitBarLabel, { color: barColor }]}>{Math.round(usedPct)}% usado</Text>
          </View>
        </View>

        {/* Frozen overlay */}
        {isFrozen && (
          <View style={styles.frozenOverlay}>
            <View style={styles.frozenBadge}>
              <Text style={styles.frozenLabel}>BLOQUEADO</Text>
            </View>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    width: 36,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#c8a84b',
    padding: 4,
    gap: 2,
    shadowColor: '#a07820',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 2,
    flex: 1,
  },
  cell: {
    flex: 1,
    borderRadius: 1,
    backgroundColor: '#e8c96a',
    opacity: 0.7,
  },
  line: {
    height: 1,
    backgroundColor: '#a07820',
    opacity: 0.5,
  },
});

const styles = StyleSheet.create({
  container: {
    width: VIRTUAL_CARD_WIDTH,
    height: VIRTUAL_CARD_HEIGHT,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 16,
  },
  frozenContainer: {
    opacity: 0.55,
  },
  background: {
    flex: 1,
    padding: 22,
    justifyContent: 'space-between',
    borderRadius: 20,
    overflow: 'hidden',
  },
  glowBlob: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -60,
    right: -40,
    opacity: 0.15,
  },
  circleDecor1: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    bottom: -50,
    left: -50,
    opacity: 0.15,
  },
  circleDecor2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    bottom: -20,
    left: 60,
    opacity: 0.1,
  },
  shineOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  cardNameText: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    maxWidth: '75%',
  },
  chipRow: {
    zIndex: 1,
  },
  bottomSection: {
    gap: 10,
    zIndex: 1,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  limitBarWrapper: {
    gap: 4,
  },
  limitBarTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  limitBarFill: {
    height: 3,
    borderRadius: 2,
  },
  limitBarLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  cardInfo: {
    gap: 4,
  },
  balanceInfo: {
    alignItems: 'flex-end',
    gap: 4,
  },
  label: {
    fontWeight: '600',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  cardholderName: {
    fontSize: 17,
    letterSpacing: 2,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  balanceValue: {
    fontSize: 15,
    letterSpacing: 0.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    borderRadius: 20,
  },
  frozenBadge: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  frozenLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 4,
  },
});
