import React, { createContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('fast_session');
    return savedUser ? JSON.parse(savedUser) : null;
  }); 
  const [profileLogo, setProfileLogo] = useState(null);

  useEffect(() => {
    const refreshCompanyData = async () => {
      const savedUser = localStorage.getItem('fast_session');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        // Toujours rafraîchir les données de l'entreprise au chargement
        const { data: companies } = await supabase.from('companies').select('*');
        if (companies && parsedUser.companyId) {
          const comp = companies.find(c => c.id === parsedUser.companyId);
          if (comp) {
            parsedUser.company = {
              ...comp,
              footer_text: comp.legal_info?.footer_text || '',
              legalInfo: comp.legal_info,
              subscription: { status: comp.subscription_status, endDate: comp.subscription_end_date }
            };
          }
        }
        setUser(parsedUser);
      }
    };
    refreshCompanyData();
  }, []);

  const getCompanies = async () => {
    const { data, error } = await supabase.from('companies').select('*');
    if (error) throw error;
    // Format to match frontend structure
    return (data || []).map(c => ({
      ...c,
      footer_text: c.legal_info?.footer_text || '',
      legalInfo: c.legal_info,
      subscription: { status: c.subscription_status, endDate: c.subscription_end_date }
    }));
  };
  
  const getUsers = async () => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return (data || []).map(u => ({
      ...u,
      companyId: u.company_id
    }));
  };
  
  const createCompany = async (data, abonnementJours = 30) => {
    const endDate = new Date(Date.now() + abonnementJours * 24 * 60 * 60 * 1000).toISOString();
    
    // Upload logo to Supabase Storage if it's a base64 string
    let logoUrl = data.logo;
    if (logoUrl && logoUrl.startsWith('data:image')) {
      const fetchResponse = await fetch(logoUrl);
      const blob = await fetchResponse.blob();
      const ext = blob.type.split('/')[1] || 'png';
      const fileName = `logo_${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('logos').upload(fileName, blob);
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
        logoUrl = publicUrlData.publicUrl;
      }
    }

    const formattedData = { 
      name: data.name,
      legal_info: { ...data.legalInfo, footer_text: data.footer_text },
      logo: logoUrl || null,
      subscription_status: 'active',
      subscription_end_date: endDate
    };

    const { data: insertedData, error } = await supabase.from('companies').insert([formattedData]).select();
    if (error) throw error;
    
    const inserted = insertedData[0];
    return {
      ...inserted,
      footer_text: inserted.legal_info?.footer_text || '',
      legalInfo: inserted.legal_info,
      subscription: { status: inserted.subscription_status, endDate: inserted.subscription_end_date }
    };
  };

  const createUser = async (data) => {
    const cleanEmail = data.email.trim().toLowerCase();
    
    // Check if exists
    const { data: existing } = await supabase.from('users').select('id').eq('email', cleanEmail);
    if (existing && existing.length > 0) {
      throw new Error("Cet email est déjà utilisé.");
    }
    
    const newUser = {
      company_id: data.companyId,
      name: data.name.trim(),
      email: cleanEmail,
      password: data.password.trim(),
      role: data.role || 'declarant'
    };

    const { data: insertedData, error } = await supabase.from('users').insert([newUser]).select();
    if (error) throw error;
    
    const inserted = insertedData[0];
    return { ...inserted, companyId: inserted.company_id };
  };

  const updateUser = async (userId, updateData) => {
    const formattedData = { ...updateData };
    if (updateData.companyId) formattedData.company_id = updateData.companyId;

    const { data, error } = await supabase.from('users').update(formattedData).eq('id', userId).select();
    if (error) throw error;
    
    if (user && user.id === userId) {
      const updatedUser = { ...data[0], companyId: data[0].company_id, company: user.company };
      setUser(updatedUser);
      localStorage.setItem('fast_session', JSON.stringify(updatedUser));
    }
  };

  const removeUser = async (userId) => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;
  };

  const updateCompany = async (companyId, updateData) => {
    let logoUrl = updateData.logo;
    if (logoUrl && logoUrl.startsWith('data:image')) {
      const fetchResponse = await fetch(logoUrl);
      const blob = await fetchResponse.blob();
      const ext = blob.type.split('/')[1] || 'png';
      const fileName = `logo_${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('logos').upload(fileName, blob);
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
        logoUrl = publicUrlData.publicUrl;
      }
    }

    const formattedData = {};
    if (updateData.name) formattedData.name = updateData.name;
    if (updateData.legalInfo || updateData.footer_text !== undefined) {
      formattedData.legal_info = { 
        ...(updateData.legalInfo || {}), 
        footer_text: updateData.footer_text !== undefined ? updateData.footer_text : (updateData.legalInfo?.footer_text || '') 
      };
    }
    if (logoUrl !== undefined) formattedData.logo = logoUrl;

    const { data, error } = await supabase.from('companies').update(formattedData).eq('id', companyId).select();
    if (error) throw new Error("Erreur: " + error.message);
    
    const updated = data[0];
    const frontendComp = {
      ...updated,
      name: updated.name,
      logo: updated.logo,
      footer_text: updated.legal_info?.footer_text || '',
      legalInfo: updated.legal_info,
      subscription: { status: updated.subscription_status, endDate: updated.subscription_end_date }
    };

    if (user && user.companyId === companyId) {
      setUser({ ...user, company: frontendComp });
      localStorage.setItem('fast_session', JSON.stringify({ ...user, company: frontendComp }));
    }
    return frontendComp;
  };

  const changePassword = async (userId, oldPassword, newPassword) => {
    const { data: users } = await supabase.from('users').select('password').eq('id', userId);
    if (users && users.length > 0) {
      if (users[0].password !== oldPassword) {
        throw new Error("L'ancien mot de passe est incorrect.");
      }
      const { error } = await supabase.from('users').update({ password: newPassword }).eq('id', userId);
      if (error) throw error;
      return true;
    }
    throw new Error("Utilisateur non trouvé.");
  };

  const renewSubscription = async (companyId, daysToAdd) => {
    const { data: comps } = await supabase.from('companies').select('subscription_end_date').eq('id', companyId);
    if (comps && comps.length > 0) {
      const newEndDate = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase.from('companies')
        .update({ subscription_status: 'active', subscription_end_date: newEndDate })
        .eq('id', companyId)
        .select();
        
      if (error) throw error;
      
      if (user && user.companyId === companyId) {
        const updated = data[0];
        setUser({ 
          ...user, 
          company: {
            ...updated,
            legalInfo: updated.legal_info,
            subscription: { status: updated.subscription_status, endDate: updated.subscription_end_date }
          } 
        });
      }
      return true;
    }
    throw new Error("Entreprise non trouvée.");
  };

  const login = async (email, password) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    
    const { data: users, error } = await supabase.from('users')
      .select('*, companies(*)')
      .eq('email', cleanEmail)
      .eq('password', cleanPassword);
      
    if (error) throw new Error("Erreur de connexion.");
    
    if (users && users.length > 0) {
      const foundUser = users[0];
      const { password: _, companies, company_id, ...sessionUser } = foundUser;
      sessionUser.companyId = company_id;
      
      if (companies) {
        sessionUser.company = {
          ...companies,
          footer_text: companies.legal_info?.footer_text || '',
          legalInfo: companies.legal_info,
          subscription: { status: companies.subscription_status, endDate: companies.subscription_end_date }
        };
      }
      
      setUser(sessionUser);
      localStorage.setItem('fast_session', JSON.stringify(sessionUser));
      return sessionUser;
    }
    
    throw new Error("Identifiants incorrects. Vérifiez l'adresse email et le mot de passe.");
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('fast_session');
  };

  const updateSubscription = async (newStatus, daysToAdd) => {
    // Legacy support for user sub
  };

  return (
    <UserContext.Provider value={{ 
      user, profileLogo, setProfileLogo, login, logout, updateSubscription,
      getCompanies, getUsers, createCompany, updateCompany, createUser, updateUser, removeUser, changePassword, renewSubscription
    }}>
      {children}
    </UserContext.Provider>
  );
};
