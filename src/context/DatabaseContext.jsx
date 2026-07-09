import React, { createContext, useState, useEffect, useContext } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { UserContext } from './UserContext';
import localforage from 'localforage';

export const DatabaseContext = createContext();

export const DatabaseProvider = ({ children }) => {
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [tariffs, setTariffs] = useState([]); // parsed JSON from Excel
  const [documents, setDocuments] = useState({
    codeDouanes: null,
    reglementation: null,
    notesExplicatives: null,
    decisionsArretes: null,
    tarifDouanier: null
  });
  const [notesHistory, setNotesHistory] = useState([]);
  const [pendingNotes, setPendingNotes] = useState([]);
  
  const { user } = useContext(UserContext);

  // Sync logic for pending notes
  const syncPendingNotes = async () => {
    const notes = await localforage.getItem('pending_notes');
    if (notes && notes.length > 0) {
      try {
        const { data, error } = await supabase.from('notes_history').insert(notes).select();
        if (!error && data) {
          await localforage.removeItem('pending_notes');
          setPendingNotes([]);
          const syncedNotes = data.map(n => ({ ...n.note_data, id: n.id }));
          setNotesHistory(prev => {
            const filtered = prev.filter(n => !n.id.toString().startsWith('temp-'));
            return [...syncedNotes, ...filtered];
          });
          alert("Vos notes hors-ligne ont été synchronisées avec succès !");
        }
      } catch (err) {
        console.error("Sync failed", err);
      }
    }
  };

  useEffect(() => {
    localforage.getItem('pending_notes').then(notes => {
      if (notes && notes.length > 0) {
        setPendingNotes(notes);
        const formattedPending = notes.map((n, idx) => ({ ...n.note_data, id: 'temp-load-' + idx }));
        setNotesHistory(prev => {
          const filtered = prev.filter(p => !p.id.toString().startsWith('temp-'));
          return [...formattedPending, ...filtered];
        });
      }
    });

    const handleOnline = () => syncPendingNotes();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Initialize DB from Supabase
  useEffect(() => {
    const initDb = async () => {
      try {
        // 1. Charger l'historique des notes
        if (user) {
          if (!navigator.onLine) {
            const cachedNotes = await localforage.getItem(`notes_history_cache_${user.id}`);
            if (cachedNotes) {
              setNotesHistory(prev => {
                const pending = prev.filter(p => p.id.toString().startsWith('temp-'));
                return [...pending, ...cachedNotes];
              });
            }
          } else {
            let query = supabase.from('notes_history').select('*').order('created_at', { ascending: false });
            // Si l'utilisateur est un déclarant, il ne voit que ses notes ou celles de son entreprise
            if (user.role === 'declarant') {
              query = query.eq('company_id', user.companyId);
            }
            
            // Timeout de 3 secondes pour éviter que l'application ne "pende"
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ error: new Error('Timeout') }), 3000));
            const { data: notes, error: notesError } = await Promise.race([query, timeoutPromise]);
            
            if (!notesError && notes) {
              const formatted = notes.map(n => ({ ...n.note_data, id: n.id }));
              setNotesHistory(prev => {
                const pending = prev.filter(p => p.id.toString().startsWith('temp-'));
                return [...pending, ...formatted];
              });
              // Sauvegarde pour le mode hors-ligne
              await localforage.setItem(`notes_history_cache_${user.id}`, formatted);
            } else {
              // Mode hors ligne : charger l'historique en cache
              const cachedNotes = await localforage.getItem(`notes_history_cache_${user.id}`);
              if (cachedNotes) {
                setNotesHistory(prev => {
                  const pending = prev.filter(p => p.id.toString().startsWith('temp-'));
                  return [...pending, ...cachedNotes];
                });
              }
            }
          }
        }

        // 2. Tenter de charger le JSON du tarif depuis le Supabase Storage
        try {
          const { data: tariffUrlData } = supabase.storage.from('documents').getPublicUrl('tariffs_data.json');
          if (tariffUrlData && tariffUrlData.publicUrl) {
            // Ajouter un timestamp pour éviter le cache navigateur si nécessaire, mais Vercel cache très bien.
            const response = await fetch(tariffUrlData.publicUrl);
            if (response.ok) {
              const jsonData = await response.json();
              setTariffs(jsonData);
              // On sauvegarde en cache local pour la performance
              await localforage.setItem('tariffs_data', jsonData);
            } else {
              // Fallback au cache local
              const localTariffs = await localforage.getItem('tariffs_data');
              if (localTariffs) setTariffs(localTariffs);
            }
          }
        } catch (e) {
          // Fallback au cache local
          const localTariffs = await localforage.getItem('tariffs_data');
          if (localTariffs) setTariffs(localTariffs);
        }

        setIsDbLoaded(true);
      } catch (error) {
        console.error("Erreur lors de l'initialisation de la base de données:", error);
        setIsDbLoaded(true);
      }
    };
    initDb();
  }, [user]);

  const uploadDocument = async (key, file) => {
    try {
      // Pour les documents normaux, on les stocke dans le bucket 'documents'
      const ext = file.name.split('.').pop();
      const fileName = `${key}.${ext}`; // Ex: tarifDouanier.xlsx
      
      const { data, error } = await supabase.storage.from('documents').upload(fileName, file, {
        upsert: true
      });
      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(fileName);
      setDocuments(prev => ({ ...prev, [key]: publicUrlData.publicUrl }));

      // Si c'est le tarif douanier (Excel), on le parse et on envoie le JSON sur Supabase Storage
      if (key === 'tarifDouanier' && file.name.endsWith('.xlsx')) {
        await parseAndUploadTariffExcel(file);
      }
    } catch (error) {
      console.error(`Erreur d'upload pour ${key}:`, error);
      throw error;
    }
  };

  const parseAndUploadTariffExcel = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          
          setTariffs(jsonData);
          await localforage.setItem('tariffs_data', jsonData);

          // Upload JSON array to Supabase Storage as a file
          const jsonBlob = new Blob([JSON.stringify(jsonData)], { type: 'application/json' });
          await supabase.storage.from('documents').upload('tariffs_data.json', jsonBlob, { upsert: true });

          resolve(jsonData);
        } catch (error) {
          console.error("Erreur de parsing de l'Excel:", error);
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const saveNote = async (note) => {
    if (!user) return;
    
    // Note format in DB:
    const noteData = { ...note, date: new Date().toISOString() };
    const newNoteDB = {
      user_id: user.id,
      company_id: user.companyId,
      note_data: noteData
    };

    const dossierToMatch = note.infos?.noDossier;
    const existingNote = notesHistory.find(n => n.infos?.noDossier === dossierToMatch && dossierToMatch);

    if (navigator.onLine) {
      if (existingNote && !existingNote.id.toString().startsWith('temp-')) {
        const { data, error } = await supabase.from('notes_history').update({ note_data: noteData }).eq('id', existingNote.id).select();
        if (!error && data) {
          const savedNote = { ...data[0].note_data, id: data[0].id };
          setNotesHistory(prev => prev.map(n => n.id === existingNote.id ? savedNote : n));
        } else {
          throw error || new Error("Impossible de mettre à jour la note");
        }
      } else {
        const { data, error } = await supabase.from('notes_history').insert([newNoteDB]).select();
        if (!error && data) {
          const savedNote = { ...data[0].note_data, id: data[0].id };
          setNotesHistory(prev => {
            const filtered = existingNote ? prev.filter(n => n.id !== existingNote.id) : prev;
            return [savedNote, ...filtered];
          });
        } else {
          throw error || new Error("Impossible de sauvegarder la note");
        }
      }
    } else {
      const savedNote = { ...noteData, id: existingNote ? existingNote.id : 'temp-' + Date.now() };
      
      setNotesHistory(prev => {
        if (existingNote) return prev.map(n => n.id === existingNote.id ? savedNote : n);
        return [savedNote, ...prev];
      });
      
      let updatedPending = [...pendingNotes];
      const pendingIndex = updatedPending.findIndex(p => p.note_data?.infos?.noDossier === dossierToMatch);
      if (pendingIndex >= 0) {
        updatedPending[pendingIndex] = newNoteDB;
      } else {
        // Pour une note en ligne modifiée hors-ligne, cela créera hélas un doublon à la synchro, 
        // mais au moins ça évite les doublons locaux multiples pour la même session hors-ligne.
        updatedPending.push(newNoteDB);
      }
      
      setPendingNotes(updatedPending);
      await localforage.setItem('pending_notes', updatedPending);
      alert("⚠️ Vous êtes hors-ligne. Note enregistrée localement, elle sera synchronisée dès le retour d'internet.");
    }
  };

  const deleteNote = async (id) => {
    const { error } = await supabase.from('notes_history').delete().eq('id', id);
    if (!error) {
      setNotesHistory(prev => prev.filter(n => n.id !== id));
    } else {
      throw error;
    }
  };

  return (
    <DatabaseContext.Provider value={{ 
      isDbLoaded, tariffs, documents, uploadDocument, 
      notesHistory, setNotesHistory, saveNote, deleteNote, pendingNotes, syncPendingNotes
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};
