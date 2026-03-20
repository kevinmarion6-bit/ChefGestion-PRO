import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, StyleSheet, Alert, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import { router } from 'expo-router';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Card, Btn, ListItem, Empty, SectionTitle } from '@/components/UI';
import { useApp } from '@/lib/context';
import { Auth, Dashboard, Restaurant, Fiches } from '@/lib/api';
import { getToken } from '@/lib/auth';

declare global {
  var __editFiche: any;
}

type SubPage = null | 'suppliers' | 'haccp' | 'settings' | 'restaurant' | 'fiches';

// ═════════════════════════════════════════════════════════════
// ─── FICHES TECHNIQUES ──────────────────────────────────────
// ═════════════════════════════════════════════════════════════

function FichesPage({ goBack }: { goBack: () => void }) {
  const [fiches, setFiches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { loadFiches(); }, []);

  async function loadFiches() {
    setLoading(true);
    try {
      const data = await Fiches.list();
      setFiches(data ?? []);
    } catch (err) {
      console.error('[Fiches]', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, nom: string) {
    Alert.alert('Supprimer', `Supprimer la fiche "${nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await Fiches.remove(id);
            setExpandedId(null);
            loadFiches();
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer.');
          }
        }
      }
    ]);
  }

  async function handlePrint(fiche: any) {
    const ings = typeof fiche.ingredients === 'string' ? JSON.parse(fiche.ingredients) : (fiche.ingredients || []);
    const portions = fiche.portions || 4;
    const total = parseFloat(fiche.total_ht || 0);
    const pvttc = parseFloat(fiche.pv_ttc || 0);
    const perte = parseFloat(fiche.perte || 2);
    const pp = total / portions;
    const ppav = pp * (1 + perte / 100);
    const pvht = pvttc / 1.1;
    const mb = pvht - ppav;
    const tm = pvht > 0 ? (mb / pvht) * 100 : 0;

    const logoUrl = 'https://osnckjlgqqawcgduideb.supabase.co/storage/v1/object/public/assets/logo.png';
    const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const year = new Date().getFullYear();

    let restName = '';
    let chefName = 'Le Chef';
    try {
      const r = await Restaurant.get();
      if (r?.nom) restName = r.nom;
    } catch {}
    try {
      const me = await Auth.me();
      if (me?.name) chefName = me.name;
    } catch {}

    const rows = ings.map((i: any, idx: number) => {
      const prix = parseFloat((i.p || '0').replace(',', '.'));
      const qte = parseFloat((i.q || '0').replace(',', '.'));
      const t = prix * qte;
      return `<tr style="background:${idx % 2 === 0 ? '#FFF' : '#FAFAF7'}">
        <td style="padding:5px 10px;font-size:11px;">${i.d || '—'}</td>
        <td style="padding:5px 10px;text-align:center;font-size:11px;color:#555;">${i.u}</td>
        <td style="padding:5px 10px;text-align:right;font-size:11px;">${prix.toFixed(3)} €</td>
        <td style="padding:5px 10px;text-align:center;font-size:11px;">${qte.toFixed(3)}</td>
        <td style="padding:5px 10px;text-align:right;font-size:11px;color:#A07D1C;font-weight:700;">${t.toFixed(3)} €</td>
      </tr>`;
    }).join('');

    const progression = (fiche.progression || '—').split('\n').filter((l: string) => l.trim()).map((line: string, i: number) =>
      `<div style="display:flex;gap:10px;margin-bottom:6px;"><span style="background:#D4AF37;color:#FFF;font-size:10px;font-weight:700;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</span><span style="font-size:12px;color:#333;line-height:1.7;">${line.trim()}</span></div>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>
        @page { margin: 0; size: A4; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Helvetica, Arial, sans-serif; color: #2C2C2C; height: 100%; display: flex; flex-direction: column; }
        html { height: 100%; }
        .content-wrap { flex: 1; }
        .header { background: linear-gradient(135deg, #0C0C0C, #1A1A1A); padding: 20px 40px; display: flex; align-items: center; gap: 24px; }
        .header img { width: 76px; height: 76px; border-radius: 14px; border: 2px solid #D4AF37; }
        .header-info { flex: 1; }
        .gold-bar { height: 3px; background: linear-gradient(90deg, #A07D1C, #D4AF37, #EAD06A, #D4AF37, #A07D1C); }
        table { width: 100%; border-collapse: collapse; border: 1px solid #E8E0D0; border-radius: 8px; overflow: hidden; }
        thead th { background: linear-gradient(135deg, #111, #1A1A1A); color: #D4AF37; padding: 8px 10px; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; }
        .kpi-box { border: 1px solid #E8E0D0; border-radius: 6px; padding: 8px 6px; text-align: center; background: #FAFAF7; border-top: 3px solid #D4AF37; }
        .kpi-label { font-size: 7px; letter-spacing: 2px; color: #8A7A60; text-transform: uppercase; margin-bottom: 4px; }
        .kpi-val { font-size: 20px; color: #A07D1C; font-weight: 700; }
        .section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .section-title { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #1A1A1A; font-weight: 600; }
        .section-line { flex: 1; height: 1px; background: linear-gradient(90deg, #D4AF37, transparent); }
        .footer { margin-top: auto; background: linear-gradient(135deg, #0C0C0C, #1A1A1A); padding: 18px 40px; display: flex; justify-content: space-between; }
      </style>
    </head><body>
      <div class="content-wrap">
        <div class="header">
          <img src="${logoUrl}" />
          <div class="header-info">
            <div style="font-size:14px;letter-spacing:5px;color:#D4AF37;text-transform:uppercase;">✦ ChefGestion Pro ✦</div>
            ${restName ? `<div style="font-size:24px;color:#F5F5DC;font-weight:600;">🍽️ ${restName}</div>` : ''}
            <div style="font-size:14px;color:#F5F5DC;margin-top:5px;">👨‍🍳 &nbsp; <span style="color:#D4AF37;font-weight:600;">Chef</span> &nbsp; ${chefName}</div>
          </div>
          <div style="font-size:15px;color:#8A7A60;text-align:right;">📅 ${today}</div>
        </div>
        <div class="gold-bar"></div>

        <div style="text-align:center;padding:14px 40px 0;">
          <div style="border:2px solid #D4AF37;border-radius:8px;padding:10px 20px;display:inline-block;">
            <div style="font-size:8px;letter-spacing:4px;color:#A07D1C;text-transform:uppercase;margin-bottom:6px;">📋 Fiche Technique ${year}</div>
            <div style="font-size:26px;color:#1A1A1A;font-weight:700;">${fiche.emoji || ''} ${fiche.nom}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;padding:14px 40px;">
          <div class="kpi-box"><div class="kpi-label">Nb Portions</div><div class="kpi-val">${portions}</div></div>
          <div class="kpi-box"><div class="kpi-label">Coût Total HT</div><div class="kpi-val">${total.toFixed(2)}€</div></div>
          <div class="kpi-box"><div class="kpi-label">Prix / Portion</div><div class="kpi-val">${pp.toFixed(2)}€</div></div>
          <div class="kpi-box"><div class="kpi-label">Taux Marge</div><div class="kpi-val">${tm.toFixed(1)}%</div></div>
        </div>

        <div style="padding:0 40px;margin-bottom:12px;">
          <div class="section-head"><span>🥘</span><span class="section-title">Ingrédients & Valorisation</span><div class="section-line"></div></div>
          <table><thead><tr><th>Denrée</th><th style="text-align:center;">Unité</th><th style="text-align:right;">Prix Unit. HT</th><th style="text-align:center;">Quantité</th><th style="text-align:right;">PR HT</th></tr></thead>
          <tbody>${rows}
            <tr style="background:rgba(212,175,55,0.08);border-top:2px solid #D4AF37;">
              <td colspan="4" style="padding:10px;text-align:right;font-weight:700;font-size:13px;">TOTAL COÛT MATIÈRE HT</td>
              <td style="padding:10px;text-align:right;color:#A07D1C;font-weight:700;font-size:15px;">${total.toFixed(2)} €</td>
            </tr>
          </tbody></table>
        </div>

        <div style="padding:0 40px;margin-bottom:12px;">
          <div class="section-head"><span>💶</span><span class="section-title">Synthèse Financière</span><div class="section-line"></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            <div class="kpi-box"><div class="kpi-label">PV HT</div><div class="kpi-val">${pvht.toFixed(2)}€</div></div>
            <div class="kpi-box"><div class="kpi-label">Marge Brute</div><div class="kpi-val">${mb.toFixed(2)}€</div></div>
            <div class="kpi-box"><div class="kpi-label">Prix Portion Avec Perte</div><div class="kpi-val">${ppav.toFixed(2)}€</div></div>
          </div>
        </div>

        <div style="padding:0 40px;margin-bottom:12px;">
          <div class="section-head"><span>👨‍🍳</span><span class="section-title">Progression de la Recette</span><div class="section-line"></div></div>
          <div style="background:#FAFAF7;border:1px solid #E8E0D0;border-radius:8px;padding:14px;">
            ${progression}
          </div>
        </div>
      </div>

      <div class="footer">
        <span style="font-size:10px;color:#8A7A60;font-style:italic;">📄 Document généré automatiquement</span>
        <span style="font-size:10px;letter-spacing:3px;color:#D4AF37;text-transform:uppercase;">✦ ChefGestion Pro ✦</span>
        <span style="font-size:10px;color:#8A7A60;">© ${year} — Tous droits réservés</span>
      </div>
      <script>(function(){var b=document.body,p=1122;if(b.scrollHeight>p){var s=p/b.scrollHeight;if(s<0.7)s=0.7;b.style.transform='scale('+s+')';b.style.transformOrigin='top left';b.style.width=(100/s)+'%';}})()</script>
    </body></html>`;

    try {
      await Print.printAsync({ html });
    } catch {
      Alert.alert('Erreur', "Impossible d'exporter en PDF.");
    }
  }

  function handleEdit(fiche: any) {
    // Naviguer vers Outils avec les données pré-remplies
    Alert.alert(
      '✏️ Modifier la fiche',
      'Cette fonctionnalité ouvre la fiche dans Outils → Fiche Technique pour modification. Enregistrez-la à nouveau après modification.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Ouvrir dans Outils',
          onPress: () => {
            // Stocker la fiche en mémoire pour la récupérer dans tools.tsx
            global.__editFiche = fiche;
            goBack();
            setTimeout(() => {
              const { router } = require('expo-router');
              router.push({ pathname: '/(tabs)/tools', params: { editFiche: 'true' } });
            }, 300);
          }
        }
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerSub2}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
        <View><Text style={styles.headerTitle}>Répertoire de Fiches</Text><Text style={styles.subTxt}>Vos recettes sauvegardées</Text></View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={Colors.gold} style={{ marginTop: 30 }} />
        ) : fiches.length === 0 ? (
          <Empty icon="📋" text={"Aucune fiche sauvegardée\nAllez dans Outils → Fiche Technique → Enregistrer"} />
        ) : (
          fiches.map((f: any) => {
            const isOpen = expandedId === f.id;
            const ings = typeof f.ingredients === 'string' ? JSON.parse(f.ingredients) : (f.ingredients || []);
            const date = new Date(f.updated_at).toLocaleDateString('fr-FR');

            return (
              <Card key={f.id} style={{ marginBottom: 10 }}>
                {/* ─── EN-TÊTE PLIÉ (toujours visible) ───── */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}
                  onPress={() => setExpandedId(isOpen ? null : f.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.cream, fontSize: 14, fontFamily: 'DMSans_400Regular' }}>
                      {f.emoji ? `${f.emoji} ` : ''}{f.nom}
                    </Text>
                  </View>
                  <Text style={{ color: Colors.gold, fontSize: 14 }}>{isOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {/* ─── CONTENU DÉPLIÉ ───── */}
                {isOpen && (
                  <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.1)', padding: 14, paddingTop: 10 }}>
                    {/* Infos */}
                    <Text style={{ color: Colors.muted, fontSize: 11, marginBottom: 10 }}>
                      🍽️ {f.portions} portions · 💰 {parseFloat(f.total_ht || 0).toFixed(2)}€ HT · 📅 {date}
                    </Text>

                    {/* Ingrédients */}
                    {ings.length > 0 && (
                      <View style={{ backgroundColor: 'rgba(212,175,55,0.05)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                        <Text style={{ color: Colors.gold, fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Ingrédients</Text>
                        {ings.filter((ig: any) => ig.d).map((ig: any, idx: number) => (
                          <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                            <Text style={{ color: Colors.cream, fontSize: 12 }}>{ig.d}</Text>
                            <Text style={{ color: Colors.muted, fontSize: 12 }}>{ig.q || '0'} {ig.u} · {ig.p || '0'}€</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Progression */}
                    {f.progression ? (
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ color: Colors.muted, fontSize: 10, fontStyle: 'italic', lineHeight: 16 }} numberOfLines={4}>
                          👨‍🍳 {f.progression}
                        </Text>
                      </View>
                    ) : null}

                    {/* Boutons d'action */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: Colors.gold, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                        onPress={() => handlePrint(f)}
                      >
                        <Text style={{ color: Colors.gold, fontSize: 11, fontWeight: 'bold' }}>🖨️ PDF</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: Colors.gold, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                        onPress={() => handleEdit(f)}
                      >
                        <Text style={{ color: Colors.gold, fontSize: 11, fontWeight: 'bold' }}>✏️ Modifier</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: '#F87171', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                        onPress={() => handleDelete(f.id, f.nom)}
                      >
                        <Text style={{ color: '#F87171', fontSize: 11, fontWeight: 'bold' }}>🗑️ Suppr.</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
export default function MoreScreen() {
  const [sub, setSub] = useState<SubPage>(null);
  const { user, state, addHaccpPhoto, clearAllData, logout } = useApp();

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
    : 'C';

  function goSub(p: SubPage) { setSub(p); }
  function goBack() { setSub(null); }

  if (sub === 'suppliers')  return <SuppliersPage goBack={goBack} />;
  if (sub === 'haccp')      return <HaccpPage goBack={goBack} state={state} addHaccpPhoto={addHaccpPhoto} />;
  if (sub === 'settings')   return <SettingsPage goBack={goBack} clearAllData={clearAllData} />;
  if (sub === 'restaurant') return <RestaurantPage goBack={goBack} />;
  if (sub === 'fiches') return <FichesPage goBack={goBack} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.header, { flexDirection: 'row', alignItems: 'center' }]}>
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 34, height: 34, borderRadius: 8, marginRight: 10 }}
          resizeMode="contain"
        />
        <View>
          <Text style={styles.headerTitle}>Plus</Text>
          <Text style={styles.headerSub}>Navigation & Configuration</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionTitle>Modules</SectionTitle>
        <Card>
          <ListItem icon="🏭" title="Fournisseurs" subtitle="Catalogue produits & comparateur prix" onPress={() => goSub('suppliers')} />
          <ListItem icon="🌡️" title="Traçabilité HACCP" subtitle="Étiquettes & relevés températures" onPress={() => goSub('haccp')} />
          <ListItem icon="⚙️" title="Paramètres" subtitle="Compte & données" onPress={() => goSub('settings')} />
          <ListItem icon="🍽️" title="Restaurant" subtitle="Session collaborative & équipe" onPress={() => goSub('restaurant')} />
          <ListItem icon="📋" title="Répertoire de Fiches Techniques" subtitle="Vos recettes sauvegardées" onPress={() => goSub('fiches')} />
        </Card>

        <SectionTitle>Mon compte</SectionTitle>
        <Card>
          <View style={styles.profileRow}>
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{initials}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user?.name}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </View>
          <View style={{ padding: 14, paddingTop: 0 }}>
            <Btn label="Se déconnecter" onPress={() => { logout(); router.replace('/(auth)/login'); }} variant="outline" />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

// ═════════════════════════════════════════════════════════════
// ─── RESTAURANT (Version 2 Rôles : Owner & Admin) ───────────
// ═════════════════════════════════════════════════════════════

function RestaurantPage({ goBack }: { goBack: () => void }) {
  const [loading, setLoading]       = useState(true);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [view, setView]             = useState<'home' | 'join' | 'create'>('home');
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining]       = useState(false);
  const [inviting, setInviting]     = useState(false);
  const [creating, setCreating]     = useState(false);
  
  const [nom, setNom]               = useState('');
  const [adresse, setAdresse]       = useState('');
  const [telephone, setTelephone]   = useState('');
  const [siret, setSiret]           = useState('');

  useEffect(() => { loadRestaurant(); }, []);

  async function loadRestaurant() {
    setLoading(true);
    try {
      const data = await Restaurant.get();
      setRestaurant(data);
    } catch (e) {
      console.error('[Restaurant]', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    Alert.alert(
      'Supprimer un membre',
      `Voulez-vous vraiment retirer ${memberName} de l'équipe ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await Restaurant.removeMember(memberId); 
              Alert.alert('Succès', 'Membre retiré.');
              loadRestaurant();
            } catch (e: any) {
              Alert.alert('Erreur', e?.message || "Impossible de supprimer le membre.");
            }
          }
        }
      ]
    );
  }

  async function handleJoin() {
    if (!inviteCode.trim()) {
      Alert.alert('Erreur', "Saisissez un code d'invitation.");
      return;
    }
    setJoining(true);
    try {
      const data = await Restaurant.join(inviteCode.trim());
      Alert.alert('✅ Bienvenue !', `Vous avez rejoint le restaurant.`);
      setView('home');
      setInviteCode('');
      loadRestaurant();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || "Code invalide ou expiré.");
    } finally {
      setJoining(false);
    }
  }

  async function handleCreate() {
    if (!nom.trim()) {
      Alert.alert('Erreur', 'Le nom du restaurant est requis.');
      return;
    }
    setCreating(true);
    try {
      await Restaurant.create({ nom: nom.trim(), adresse: adresse.trim(), telephone: telephone.trim(), siret: siret.trim() });
      Alert.alert('✅ Créé !', `"${nom.trim()}" est prêt.`);
      setView('home');
      setNom(''); setAdresse(''); setTelephone(''); setSiret('');
      loadRestaurant();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de créer le restaurant.');
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite() {
    setInviting(true);
    try {
      const data = await Restaurant.invite();
      const message = `🍽️ Rejoignez mon restaurant sur ChefGestion PRO !\n\nVotre code d'invitation : ${data.code}\n\nValide 7 jours. Entrez ce code dans Plus → Restaurant → Rejoindre.`;
      await Share.share({ message, title: 'Invitation ChefGestion PRO' });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Erreur', e?.message || "Impossible de générer l'invitation.");
      }
    } finally {
      setInviting(false);
    }
  }

  async function handleLeave() {
    Alert.alert(
      'Quitter le restaurant ?',
      'Vous perdrez l\'accès aux données partagées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter', style: 'destructive',
          onPress: async () => {
            try {
              await Restaurant.leave();
              setRestaurant(null);
              Alert.alert('✅ Terminé', 'Vous avez quitté le restaurant.');
            } catch (e: any) {
              Alert.alert('Erreur', e?.message || 'Impossible de quitter.');
            }
          },
        },
      ]
    );
  }

  // ─── LOADING ───────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerSub2}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
          <View><Text style={styles.headerTitle}>Restaurant</Text><Text style={styles.subTxt}>Session collaborative</Text></View>
        </View>
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  // ─── DÉJÀ DANS UN RESTAURANT ───────────────────────────
  if (restaurant) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerSub2}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
          <View><Text style={styles.headerTitle}>Restaurant</Text><Text style={styles.subTxt}>{restaurant.nom}</Text></View>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

          {/* Infos restaurant */}
          <Card>
            <View style={{ padding: 16, alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 32 }}>🍽️</Text>
              <Text style={{ color: Colors.cream, fontSize: 18, fontFamily: 'Cinzel_700Bold', textAlign: 'center' }}>{restaurant.nom}</Text>
              {restaurant.adresse ? <Text style={{ color: Colors.muted, fontSize: 12, textAlign: 'center' }}>📍 {restaurant.adresse}</Text> : null}
              {restaurant.telephone ? <Text style={{ color: Colors.muted, fontSize: 12 }}>📞 {restaurant.telephone}</Text> : null}
              {restaurant.siret ? <Text style={{ color: Colors.muted, fontSize: 11, fontStyle: 'italic' }}>SIRET: {restaurant.siret}</Text> : null}
            </View>
          </Card>

          {/* Bouton inviter */}
          {restaurant.isOwner && (
            <Btn
              label={inviting ? 'Génération...' : '📨  Inviter un Admin'}
              onPress={handleInvite}
              loading={inviting}
              style={{ marginTop: 12 }}
            />
          )}

          {/* Membres */}
          <SectionTitle style={{ marginTop: 20 }}>Équipe</SectionTitle>
          <Card>
            {(restaurant.members ?? []).map((m: any) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', gap: 10 }}>
                <View style={[styles.avatar, { width: 36, height: 36, borderRadius: 18 }]}>
                  <Text style={[styles.avatarTxt, { fontSize: 14 }]}>
                    {m.name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.cream, fontSize: 14 }}>
                    {m.name} {m.isMe ? '(vous)' : ''}
                  </Text>
                  <Text style={{ color: Colors.gold, fontSize: 11, fontStyle: 'italic', marginTop: 1 }}>
                    {m.role === 'owner' ? '👑 Chef' : '⭐ Co-Chef/Second'}
                  </Text>
                </View>

                {/* BOUTON SUPPRESSION : Uniquement pour l'Owner */}
                {restaurant.isOwner && !m.isMe && (
                  <TouchableOpacity onPress={() => handleRemoveMember(m.id, m.name)} style={{ padding: 8 }}>
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </Card>

          {/* Quitter (si pas owner) */}
          {!restaurant.isOwner && (
            <Btn
              label="🚪  Quitter le restaurant"
              onPress={handleLeave}
              variant="danger"
              style={{ marginTop: 20 }}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── PAS DE RESTAURANT — ÉCRAN CHOIX ───────────────────
  if (view === 'join') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerSub2}>
          <TouchableOpacity onPress={() => setView('home')} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
          <View><Text style={styles.headerTitle}>Rejoindre</Text><Text style={styles.subTxt}>Entrez votre code d'invitation</Text></View>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: 40 }]}>
          <View style={{ alignItems: 'center', marginBottom: 30 }}>
            <Text style={{ fontSize: 48 }}>🔑</Text>
            <Text style={{ color: Colors.cream, fontSize: 16, fontFamily: 'Cinzel_700Bold', marginTop: 12, textAlign: 'center' }}>Code d'invitation</Text>
            <Text style={{ color: Colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
              Demandez le code à 6 caractères{'\n'}au Chef du restaurant.
            </Text>
          </View>

          <TextInput
            style={restStyles.codeInput}
            value={inviteCode}
            onChangeText={t => setInviteCode(t.toUpperCase())}
            placeholder="EX: A3F1B2"
            placeholderTextColor="#555"
            maxLength={6}
            autoCapitalize="characters"
            autoFocus
          />

          <Btn
            label={joining ? 'Vérification...' : '✅  Rejoindre le restaurant'}
            onPress={handleJoin}
            loading={joining}
            style={{ marginTop: 16 }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (view === 'create') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerSub2}>
          <TouchableOpacity onPress={() => setView('home')} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
          <View><Text style={styles.headerTitle}>Créer</Text><Text style={styles.subTxt}>Nouveau restaurant</Text></View>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 48 }}>🍽️</Text>
            <Text style={{ color: Colors.cream, fontSize: 16, fontFamily: 'Cinzel_700Bold', marginTop: 12, textAlign: 'center' }}>Créer un Restaurant</Text>
          </View>

          <Card style={{ padding: 16, gap: 14 }}>
            <View>
              <Text style={restStyles.fieldLabel}>Nom du restaurant *</Text>
              <TextInput style={restStyles.fieldInput} value={nom} onChangeText={setNom} placeholder="Ex: Le Bistrot du Chef" placeholderTextColor="#555" />
            </View>
            <View>
              <Text style={restStyles.fieldLabel}>Adresse</Text>
              <TextInput style={restStyles.fieldInput} value={adresse} onChangeText={setAdresse} placeholder="12 rue de la Cuisine, 75001 Paris" placeholderTextColor="#555" />
            </View>
            <View>
              <Text style={restStyles.fieldLabel}>N° Téléphone (Optionnel)</Text>
              <TextInput style={restStyles.fieldInput} value={telephone} onChangeText={setTelephone} placeholder="01 23 45 67 89" placeholderTextColor="#555" keyboardType="phone-pad" />
            </View>
            <View>
              <Text style={restStyles.fieldLabel}>N° SIRET (Optionnel)</Text>
              <TextInput style={restStyles.fieldInput} value={siret} onChangeText={setSiret} placeholder="123 456 789 00012" placeholderTextColor="#555" keyboardType="numeric" />
            </View>
          </Card>

          <Btn
            label={creating ? 'Création...' : '✅  Créer le restaurant'}
            onPress={handleCreate}
            loading={creating}
            style={{ marginTop: 16 }}
          />

          <Text style={{ color: Colors.muted, fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 16, fontStyle: 'italic' }}>
            Vous pourrez ensuite inviter vos collaborateurs{'\n'}à rejoindre votre session restaurant.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── ÉCRAN D'ACCUEIL RESTAURANT (pas encore de restaurant) ─
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerSub2}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
        <View><Text style={styles.headerTitle}>Restaurant</Text><Text style={styles.subTxt}>Session collaborative</Text></View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: 30 }]}>

        <View style={{ alignItems: 'center', marginBottom: 30 }}>
          <Text style={{ fontSize: 75 }}>🍽️</Text>
          <Text style={{ color: Colors.cream, fontSize: 18, fontFamily: 'Cinzel_700Bold', marginTop: 12, textAlign: 'center' }}>Session Restaurant</Text>
          <Text style={{ color: Colors.muted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 20 }}>
            Travaillez en équipe ! Partagez factures, températures et HACCP avec vos collaborateurs en temps réel.
          </Text>
        </View>

        {/* Option 1 : Rejoindre */}
        <Card style={{ padding: 20, marginBottom: 12 }}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 28 }}>🔑</Text>
            <Text style={{ color: Colors.cream, fontSize: 14, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>J'AI UN CODE D'INVITATION</Text>
            <Text style={{ color: Colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              Un collègue vous a partagé un code ?{'\n'}Entrez-le pour rejoindre sa session.
            </Text>
            <Btn label="Entrer mon code" onPress={() => setView('join')} style={{ marginTop: 8, width: '100%' }} />
          </View>
        </Card>

        {/* Séparateur */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(212,175,55,0.2)' }} />
          <Text style={{ color: Colors.muted, fontSize: 11, marginHorizontal: 12, fontStyle: 'italic' }}>ou</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(212,175,55,0.2)' }} />
        </View>

        {/* Option 2 : Créer */}
        <TouchableOpacity
          style={restStyles.createLink}
          onPress={() => setView('create')}
          activeOpacity={0.7}
        >
          <Text style={restStyles.createLinkText}>Je n'ai pas de code d'invitation</Text>
          <Text style={restStyles.createLinkCta}>Créer un Restaurant →</Text>
          <Text style={restStyles.createLinkHint}>
            (Permets de créer et enregistrer une nouvelle session de restaurant afin que plusieurs collaborateurs puissent s'y connecter et travailler avec)
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES RESTAURANT ───────────────────────────────────
const restStyles = StyleSheet.create({
  codeInput: {
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: Colors.gold,
    borderRadius: 12,
    color: '#fff',
    fontSize: 32,
    textAlign: 'center',
    paddingVertical: 18,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 8,
  },
  fieldLabel: {
    fontFamily: 'Cinzel_400Regular',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: Colors.mutedLight,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.blackMid,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: Radius.sm,
    padding: 13,
    color: Colors.cream,
    fontSize: 15,
  },
  createLink: {
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  createLinkText: {
    color: Colors.muted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  createLinkCta: {
    color: Colors.gold,
    fontSize: 14,
    fontFamily: 'Cinzel_700Bold',
    letterSpacing: 1,
    marginTop: 4,
  },
  createLinkHint: {
    color: Colors.muted,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 6,
    fontStyle: 'italic',
    paddingHorizontal: 10,
  },
});

// ═════════════════════════════════════════════════════════════
// ─── FOURNISSEURS ───────────────────────────────────────────
// ═════════════════════════════════════════════════════════════
function SuppliersPage({ goBack }: any) {
  const [name, setName]           = useState('');
  const [suppliers, setSuppliers] = useState<Record<string, any>>({});
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);

  useEffect(() => { loadSuppliers(); }, []);

  async function loadSuppliers() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('https://chefgestion-pro.onrender.com/api/suppliers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) setSuppliers(json.data ?? {});
    } catch (e) { console.error('[Suppliers]', e); }
    finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    try {
      const token = await getToken();
      const res = await fetch('https://chefgestion-pro.onrender.com/api/suppliers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (json.ok || json.data) {
        setName('');
        loadSuppliers();
        Alert.alert('✅ Ajouté !', `"${name.trim()}" a été créé.`);
      } else {
        Alert.alert('Erreur', json.error ?? "Impossible d'ajouter.");
      }
    } catch { Alert.alert('Erreur', 'Connexion impossible.'); }
    finally { setAdding(false); }
  }

  function productMap() {
    const pm: Record<string, { sup: string; price: number; unit: string }[]> = {};
    Object.entries(suppliers).forEach(([sup, d]: any) => {
      (d.products ?? []).forEach((p: any) => {
        if (!pm[p.name]) pm[p.name] = [];
        pm[p.name].push({ sup, price: p.price, unit: p.unit });
      });
    });
    return Object.entries(pm).filter(([, v]) => v.length >= 2);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerSub2}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
        <View><Text style={styles.headerTitle}>Fournisseurs</Text><Text style={styles.subTxt}>Catalogue & comparateur</Text></View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.addRow}>
          <TextInput style={[styles.addInput, { flex: 1 }]} value={name} onChangeText={setName} placeholder="Nom du fournisseur..." placeholderTextColor={Colors.muted} onSubmitEditing={handleAdd} />
          <Btn label={adding ? '...' : '+'} onPress={handleAdd} style={{ paddingHorizontal: 20 }} />
        </View>

        <SectionTitle>Mes Fournisseurs</SectionTitle>
        {loading ? (
          <ActivityIndicator color={Colors.gold} style={{ marginTop: 20 }} />
        ) : Object.keys(suppliers).length === 0 ? (
          <Empty icon="🏭" text={"Ils apparaissent automatiquement\naprès vos premiers scans"} />
        ) : (
          Object.entries(suppliers).map(([sup, d]: any) => (
            <Card key={sup}>
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)' }}>
                <Text style={styles.supName}>{sup}</Text>
                <Text style={styles.supCount}>{(d.products ?? []).length} produit(s)</Text>
              </View>
              {(d.products ?? []).slice(0, 5).map((p: any, i: number) => (
                <View key={i} style={styles.prodRow}>
                  <Text style={styles.prodName}>{p.name}</Text>
                  <Text style={styles.prodPrice}>{(p.price || 0).toFixed(2)}€/{p.unit || 'u'}</Text>
                </View>
              ))}
            </Card>
          ))
        )}

        {productMap().length > 0 && (
          <>
            <SectionTitle style={{ marginTop: 20 }}>Comparateur Prix</SectionTitle>
            {productMap().map(([prod, offers]) => (
              <Card key={prod} style={{ marginBottom: 8 }}>
                <Text style={{ color: Colors.cream, padding: 12, fontWeight: 'bold' }}>{prod}</Text>
                {offers.sort((a, b) => a.price - b.price).map((o, i) => (
                  <View key={i} style={styles.prodRow}>
                    <Text style={[styles.prodName, i === 0 && { color: Colors.ok }]}>{o.sup}</Text>
                    <Text style={[styles.prodPrice, i === 0 && { color: Colors.ok }]}>{o.price.toFixed(2)}€/{o.unit}</Text>
                  </View>
                ))}
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ═════════════════════════════════════════════════════════════
// ─── HACCP ──────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════
function HaccpPage({ goBack, state, addHaccpPhoto }: any) {
  const [fridges, setFridges]               = useState<any[]>([]);
  const [loadingFridges, setLoadingFridges] = useState(true);
  const [showAddFridge, setShowAddFridge]   = useState(false);
  const [newFridgeName, setNewFridgeName]   = useState('');
  const [newFridgeType, setNewFridgeType] = useState<'positif' | 'negatif' | 'cellule'>('positif');
  const [tempRange, setTempRange] = useState<'poissons' | 'viandes' | 'legumes'>('viandes');
  const [fridgeEmoji, setFridgeEmoji] = useState('🥩');
  const photos = state?.haccpPhotos || [];

  useEffect(() => { loadFridges(); }, []);

  async function loadFridges() {
    setLoadingFridges(true);
    try {
      const token = await getToken();
      const res = await fetch('https://chefgestion-pro.onrender.com/api/fridges', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) setFridges(json.data ?? []);
    } catch (e) { console.error('[Frigos]', e); }
    finally { setLoadingFridges(false); }
  }

  async function addFridge() {
    if (!newFridgeName.trim()) { Alert.alert('Erreur', 'Donne un nom à cet équipement'); return; }
    let temp_min = 0, temp_max = 4;
    if (newFridgeType === 'negatif') { temp_min = -21; temp_max = -18; }
    else if (newFridgeType === 'cellule') { temp_min = 0; temp_max = 3; }
    else if (newFridgeType === 'positif') {
      if (tempRange === 'poissons') { temp_min = 0; temp_max = 2; }
      else if (tempRange === 'viandes') { temp_min = 0; temp_max = 4; }
      else { temp_min = 0; temp_max = 8; }
    }

    try {
      const token = await getToken();
      const res = await fetch('https://chefgestion-pro.onrender.com/api/fridges', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: newFridgeName.trim(), type: newFridgeType, temp_min, temp_max, emoji: fridgeEmoji }),
      });
      const json = await res.json();
      if (json.ok) {
        setNewFridgeName(''); setShowAddFridge(false); loadFridges();
        Alert.alert('✅ Ajouté !', `"${json.data.nom}" a été créé.`);
      }
    } catch { Alert.alert('Erreur', "Impossible d'ajouter cet équipement"); }
  }

  async function deleteFridge(id: string, nom: string) {
    Alert.alert('Supprimer ?', `Supprimer "${nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          const token = await getToken();
          await fetch(`https://chefgestion-pro.onrender.com/api/fridges/${id}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
          });
          loadFridges();
        },
      },
    ]);
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission requise', 'Accès caméra nécessaire.'); return; }
    Alert.alert('Source', 'Importer la photo', [
      { text: 'Appareil photo', onPress: async () => {
        const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (!r.canceled) addHaccpPhoto({ name: `Étiquette_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}`, uri: r.assets[0].uri });
      }},
      { text: 'Galerie', onPress: async () => {
        const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (!r.canceled) addHaccpPhoto({ name: `Photo_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}`, uri: r.assets[0].uri });
      }},
      { text: 'Annuler', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerSub2}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
        <View><Text style={styles.headerTitle}>Traçabilité HACCP</Text><Text style={styles.subTxt}>Sanitaire & températures</Text></View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <SectionTitle>🌡️ Mes Équipements Froids</SectionTitle>
        <Text style={{ color: '#9A8060', fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
          Configure ici tes frigos et congélateurs. Ils apparaîtront lors de chaque scan.
        </Text>

        {loadingFridges ? <ActivityIndicator color="#D4AF37" /> : (
          <>
            {fridges.length === 0 && (
              <Card><Text style={{ color: '#666', textAlign: 'center', padding: 20, fontSize: 13 }}>Aucun équipement configuré.{'\n'}Ajoute ton premier frigo ci-dessous.</Text></Card>
            )}
            {fridges.map((f: any) => (
              <Card key={f.id} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
                  <Text style={{ fontSize: 24 }}>{f.emoji || (f.type === 'negatif' ? '🧊' : '❄️')}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#E8D5A3', fontSize: 14, fontWeight: 'bold' }}>{f.nom}</Text>
                    <Text style={{ color: '#9A8060', fontSize: 11, marginTop: 2 }}>
                      {f.type === 'negatif' ? 'Congélateur' : 'Réfrigérateur'} · Cible : {f.temp_min}°C à {f.temp_max}°C
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteFridge(f.id, f.nom)}><Text style={{ color: '#F87171', fontSize: 18 }}>🗑️</Text></TouchableOpacity>
                </View>
              </Card>
            ))}

            {showAddFridge ? (
              <Card style={{ padding: 16, gap: 12 }}>
                <Text style={{ color: '#D4AF37', fontSize: 12, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>NOUVEL ÉQUIPEMENT</Text>
                <TextInput style={{ backgroundColor: '#111', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 8, color: '#fff', padding: 12, fontSize: 14 }} value={newFridgeName} onChangeText={setNewFridgeName} placeholder="Ex: Frigo Viandes, Congélateur N°2..." placeholderTextColor="#444" />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', backgroundColor: newFridgeType === 'positif' ? '#D4AF37' : '#1a1a1a', borderWidth: 1, borderColor: '#D4AF37' }}
                    onPress={() => { setNewFridgeType('positif'); setFridgeEmoji('🥩'); }}
                  >
                    <Text style={{ fontSize: 20 }}>❄️</Text>
                    <Text style={{ color: newFridgeType === 'positif' ? '#000' : '#D4AF37', fontSize: 11, marginTop: 4, fontWeight: 'bold' }}>RÉFRIGÉRATEUR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', backgroundColor: newFridgeType === 'negatif' ? '#D4AF37' : '#1a1a1a', borderWidth: 1, borderColor: '#D4AF37' }}
                    onPress={() => { setNewFridgeType('negatif'); setFridgeEmoji('🧊'); }}
                  >
                    <Text style={{ fontSize: 20 }}>🧊</Text>
                    <Text style={{ color: newFridgeType === 'negatif' ? '#000' : '#D4AF37', fontSize: 11, marginTop: 4, fontWeight: 'bold' }}>CONGÉLATEUR</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={{ padding: 12, borderRadius: 8, alignItems: 'center', backgroundColor: newFridgeType === 'cellule' ? '#D4AF37' : '#1a1a1a', borderWidth: 1, borderColor: '#D4AF37' }}
                  onPress={() => { setNewFridgeType('cellule'); setFridgeEmoji('🌬️'); }}
                >
                  <Text style={{ fontSize: 20 }}>🌬️</Text>
                  <Text style={{ color: newFridgeType === 'cellule' ? '#000' : '#D4AF37', fontSize: 11, marginTop: 4, fontWeight: 'bold' }}>CELLULE DE REFROIDISSEMENT RAPIDE</Text>
                  <Text style={{ color: newFridgeType === 'cellule' ? '#333' : '#666', fontSize: 10 }}>+63°C → +10°C en 2h max</Text>
                </TouchableOpacity>

                {newFridgeType === 'positif' && (
                  <View style={{ gap: 6, marginTop: 4 }}>
                    <Text style={{ color: '#D4AF37', fontSize: 10, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>PLAGE DE TEMPÉRATURE</Text>

                    <TouchableOpacity
                      style={{ padding: 10, borderRadius: 8, backgroundColor: tempRange === 'poissons' ? 'rgba(212,175,55,0.2)' : '#111', borderWidth: 1, borderColor: tempRange === 'poissons' ? '#D4AF37' : '#333' }}
                      onPress={() => { setTempRange('poissons'); setFridgeEmoji('🐟'); }}
                    >
                      <Text style={{ color: tempRange === 'poissons' ? '#D4AF37' : '#999', fontSize: 12, fontWeight: 'bold' }}>0°C à +2°C</Text>
                      <Text style={{ color: '#666', fontSize: 10, marginTop: 2 }}>Poissons, coquillages/crustacés, viandes hachées/maturées</Text>
                      {tempRange === 'poissons' && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            style={{ padding: 8, borderRadius: 8, backgroundColor: fridgeEmoji === '🐟' ? '#D4AF37' : '#222', borderWidth: 1, borderColor: fridgeEmoji === '🐟' ? '#D4AF37' : '#444' }}
                            onPress={() => setFridgeEmoji('🐟')}
                          >
                            <Text style={{ fontSize: 22 }}>🐟</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ padding: 8, borderRadius: 8, backgroundColor: fridgeEmoji === '🍖' ? '#D4AF37' : '#222', borderWidth: 1, borderColor: fridgeEmoji === '🍖' ? '#D4AF37' : '#444' }}
                            onPress={() => setFridgeEmoji('🍖')}
                          >
                            <Text style={{ fontSize: 22 }}>🍖</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ padding: 10, borderRadius: 8, backgroundColor: tempRange === 'viandes' ? 'rgba(212,175,55,0.2)' : '#111', borderWidth: 1, borderColor: tempRange === 'viandes' ? '#D4AF37' : '#333' }}
                      onPress={() => { setTempRange('viandes'); setFridgeEmoji('🥩'); }}
                    >
                      <Text style={{ color: tempRange === 'viandes' ? '#D4AF37' : '#999', fontSize: 12, fontWeight: 'bold' }}>0°C à +4°C</Text>
                      <Text style={{ color: '#666', fontSize: 10, marginTop: 2 }}>Viandes, BOF, produits sensibles</Text>
                      {tempRange === 'viandes' && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            style={{ padding: 8, borderRadius: 8, backgroundColor: fridgeEmoji === '🥩' ? '#D4AF37' : '#222', borderWidth: 1, borderColor: fridgeEmoji === '🥩' ? '#D4AF37' : '#444' }}
                            onPress={() => setFridgeEmoji('🥩')}
                          >
                            <Text style={{ fontSize: 22 }}>🥩</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ padding: 8, borderRadius: 8, backgroundColor: fridgeEmoji === '🧀' ? '#D4AF37' : '#222', borderWidth: 1, borderColor: fridgeEmoji === '🧀' ? '#D4AF37' : '#444' }}
                            onPress={() => setFridgeEmoji('🧀')}
                          >
                            <Text style={{ fontSize: 22 }}>🧀</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ padding: 10, borderRadius: 8, backgroundColor: tempRange === 'legumes' ? 'rgba(212,175,55,0.2)' : '#111', borderWidth: 1, borderColor: tempRange === 'legumes' ? '#D4AF37' : '#333' }}
                      onPress={() => { setTempRange('legumes'); setFridgeEmoji('🥗'); }}
                    >
                      <Text style={{ color: tempRange === 'legumes' ? '#D4AF37' : '#999', fontSize: 12, fontWeight: 'bold' }}>0°C à +8°C</Text>
                      <Text style={{ color: '#666', fontSize: 10, marginTop: 2 }}>Fruits, légumes, herbes fraîches</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={{ flex: 1, backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, alignItems: 'center' }} onPress={() => { setShowAddFridge(false); setNewFridgeName(''); }}>
                    <Text style={{ color: '#666' }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 2, backgroundColor: '#D4AF37', borderRadius: 8, padding: 12, alignItems: 'center' }} onPress={addFridge}>
                    <Text style={{ color: '#000', fontWeight: 'bold' }}>✅ Ajouter</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : (
              <Btn label="➕  Ajouter un équipement" onPress={() => setShowAddFridge(true)} style={{ marginBottom: 8 }} />
            )}
          </>
        )}

        <SectionTitle style={{ marginTop: 24 }}>Étiquettes Sanitaires</SectionTitle>
        <Btn label="📸  Ajouter une photo" onPress={pickPhoto} style={{ marginBottom: 16 }} />
        {photos.length > 0 && (
          <View style={styles.photoGrid}>
            {photos.map((p: any, i: number) => (
              <View key={i} style={styles.photoTile}>
                <Image source={{ uri: p.uri }} style={styles.photoImg} resizeMode="cover" />
                <View style={{ padding: 8 }}><Text style={styles.photoName} numberOfLines={1}>{p.name}</Text></View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ═════════════════════════════════════════════════════════════
// ─── SETTINGS ───────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════
function SettingsPage({ goBack, clearAllData }: any) {
  function handleClearData() {
    Alert.alert('Confirmer', 'Cette action est irréversible. Continuer ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Effacer', style: 'destructive', onPress: async () => {
          try { await Dashboard.clearData(); clearAllData(); }
          catch { clearAllData(); }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerSub2}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
        <View><Text style={styles.headerTitle}>Paramètres</Text><Text style={styles.subTxt}>Configuration</Text></View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.settSection}>
          <Text style={styles.settLabel}>Données</Text>
          <View style={{ padding: 14 }}>
            <Btn label="🗑️  Effacer toutes les données" onPress={handleClearData} variant="danger" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ═════════════════════════════════════════════════════════════
// ─── STYLES COMMUNS ─────────────────────────────────────────
// ═════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.blackSoft },
  header:       { padding: Spacing.md, backgroundColor: Colors.charcoal, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)' },
  headerTitle:  { fontFamily: 'Cinzel_700SemiBold', fontSize: 18, color: Colors.cream },
  headerSub:    { fontSize: 11, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  headerSub2:   { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.charcoal, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)', gap: 12 },
  subTxt:       { fontSize: 11, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backArrow:    { fontSize: 28, color: Colors.gold, lineHeight: 32 },
  scroll:       { flex: 1 },
  content:      { padding: Spacing.md, paddingBottom: 90 },
  profileRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.goldDark, borderWidth: 1, borderColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:    { fontFamily: 'Cinzel_700SemiBold', fontSize: 18, color: Colors.black },
  profileName:  { fontSize: 16, color: Colors.cream, fontWeight: '600' },
  profileEmail: { fontSize: 13, color: Colors.muted, fontStyle: 'italic' },
  addRow:       { flexDirection: 'row', gap: 10, marginBottom: 16 },
  addInput:     { backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', borderRadius: Radius.sm, padding: 12, color: Colors.cream, fontSize: 15 },
  supName:      { fontFamily: 'Cinzel_400Regular', fontSize: 13, color: Colors.cream, marginBottom: 3 },
  supCount:     { fontSize: 12, color: Colors.muted, fontStyle: 'italic' },
  prodRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  prodName:     { fontSize: 13, color: Colors.creamDark },
  prodPrice:    { fontFamily: 'DMSans_400Regular', fontSize: 13, color: Colors.gold },
  photoGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoTile:    { width: '47%', backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)', borderRadius: Radius.sm, overflow: 'hidden' },
  photoImg:     { width: '100%', height: 100 },
  photoName:    { fontSize: 12, color: Colors.cream },
  settSection:  { backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)', borderRadius: Radius.md, overflow: 'hidden', marginBottom: 14 },
  settLabel:    { fontFamily: 'Cinzel_400Regular', fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: Colors.gold, padding: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.08)' },
});