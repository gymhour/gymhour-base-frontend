import React, { useState, useEffect, useMemo } from 'react';
import '../../../App.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu.jsx';
import CustomDropdown from '../../../Components/utils/CustomDropdown/CustomDropdown.jsx';
import CustomInput from '../../../Components/utils/CustomInput/CustomInput.jsx';
import './CrearRutina.css';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton.jsx';
import apiService, { fetchAllClientsActive } from '../../../services/apiService';
import { toast } from "react-toastify";
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen.jsx';
import { useParams, useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { ReactComponent as CloseIcon } from "../../../assets/icons/close.svg";
import SecondaryButton from "../../../Components/utils/SecondaryButton/SecondaryButton.jsx";

/* ================= Helpers ================= */
const DISPLAY_TYPES = ["Series y repeticiones", "Rondas", "EMOM", "AMRAP", "Escalera", "TABATA", "DROPSET"];

const apiToDisplayType = {
  SETS_REPS: 'Series y repeticiones',
  ROUNDS: 'Rondas',
  EMOM: 'EMOM',
  AMRAP: 'AMRAP',
  LADDER: 'Escalera',
  TABATA: 'TABATA',
  DROPSET: 'DROPSET',
};

const displayToApiType = (t) => ({
  "Series y repeticiones": "SETS_REPS",
  "Rondas": "ROUNDS",
  "EMOM": "EMOM",
  "AMRAP": "AMRAP",
  "Escalera": "LADDER",
  "TABATA": "TABATA",
  "DROPSET": "DROPSET",
}[t] || "SETS_REPS");

const getRandomExercise = () =>
  [
    "Pecho plano 60kg",
    "Flexiones de brazo",
    "Press de hombro 60kg",
    "Sentadillas con barra 80kg",
    "Remo con mancuerna 40kg",
    "Dominadas",
    "Elevaciones laterales 8kg"
  ][Math.floor(Math.random() * 7)];

const makeEmptyBlock = (selectedType) => {
  const baseSet = {
    series: '',
    exercise: '',
    weight: '',
    placeholderExercise: getRandomExercise(),
    exerciseId: null
  };

  switch (selectedType) {
    case 'Series y repeticiones':
      return { id: Date.now(), type: selectedType, data: { setsReps: [{ ...baseSet }] } };

    case 'Rondas':
      return {
        id: Date.now(),
        type: selectedType,
        data: { rounds: '', descanso: '', setsReps: [{ ...baseSet }] }
      };

    case 'EMOM':
      return {
        id: Date.now(),
        type: selectedType,
        data: { interval: '1', totalMinutes: '', setsReps: [{ ...baseSet }] }
      };

    case 'AMRAP':
      return {
        id: Date.now(),
        type: selectedType,
        data: { duration: '', setsReps: [{ ...baseSet }] }
      };

    case 'Escalera':
      return {
        id: Date.now(),
        type: selectedType,
        data: { escaleraType: '', setsReps: [{ ...baseSet }] }
      };

    case 'TABATA':
      return {
        id: Date.now(),
        type: selectedType,
        data: {
          cantSeries: '',
          descTabata: '',
          tiempoTrabajoDescansoTabata: '',
          setsReps: [{ ...baseSet }]
        }
      };

    case 'DROPSET':
      // Nombre global + filas serie/kilos
      return {
        id: Date.now(),
        type: selectedType,
        data: {
          exerciseName: '',
          exerciseId: null,
          exercisePlaceholder: getRandomExercise(),
          setsReps: [{ series: '', weight: '' }]
        }
      };

    default:
      return {
        id: Date.now(),
        type: 'Series y repeticiones',
        data: { setsReps: [{ ...baseSet }] }
      };
  }
};

/* ==== Helpers para leer bloques desde API (incluye detección de DROPSET) ==== */
const getBlockItemsFromApi = (b) => {
  if (!b) return [];
  if (Array.isArray(b.bloqueEjercicios)) return b.bloqueEjercicios;
  if (Array.isArray(b.ejercicios)) return b.ejercicios;
  return [];
};

const isDropSetBlockFromApi = (b) => {
  if (!b || b.type !== 'SETS_REPS') return false;

  const items = getBlockItemsFromApi(b);
  if (!Array.isArray(items) || items.length < 2) return false;

  const firstId =
    items[0]?.ejercicio?.ID_Ejercicio ??
    items[0]?.ID_Ejercicio ??
    items[0]?.ejercicioId ??
    null;

  const firstName = (
    items[0]?.ejercicio?.nombre ||
    b?.nombreEj ||
    ''
  ).trim().toLowerCase();

  if (!firstId && !firstName) return false;

  return items.every(it => {
    const id =
      it?.ejercicio?.ID_Ejercicio ??
      it?.ID_Ejercicio ??
      it?.ejercicioId ??
      null;
    const name = (it?.ejercicio?.nombre || '').trim().toLowerCase();

    if (firstId != null && id != null) return id === firstId;
    return name && name === firstName;
  });
};

const convertApiBlockData = (b) => {
  const items = getBlockItemsFromApi(b);

  const mappedSets = items.map((e) => {
    const nombreEj =
      e?.ejercicio?.nombre ??
      e?.nombre ??
      b?.nombreEj ??
      '';
    const idEj =
      e.ID_Ejercicio ??
      e?.ejercicio?.ID_Ejercicio ??
      e?.ejercicioId ??
      null;
    const reps = e.reps ?? e.setsReps ?? b?.setsReps ?? '';
    const weight = e.setRepWeight ?? b?.weight ?? '';
    return {
      series: reps,
      exercise: nombreEj,
      weight,
      placeholderExercise: '',
      exerciseId: idEj || null
    };
  });

  // Detectar DROPSET guardado como SETS_REPS con 2+ filas del mismo ejercicio
  if (b.type === 'SETS_REPS' && isDropSetBlockFromApi(b)) {
    const first = items[0] || {};
    const exerciseName =
      b.nombreEj ||
      first?.ejercicio?.nombre ||
      first?.nombre ||
      '';
    const exerciseId =
      first?.ejercicio?.ID_Ejercicio ??
      first?.ID_Ejercicio ??
      first?.ejercicioId ??
      null;

    const setsReps = items.map(it => ({
      series: it.reps ?? b.setsReps ?? '',
      weight: it.setRepWeight ?? ''
    }));

    return {
      __isDropSet: true,
      exerciseName,
      exerciseId,
      exercisePlaceholder: '',
      setsReps
    };
  }

  switch (b.type) {
    case 'SETS_REPS':
      return {
        setsReps: mappedSets.length
          ? mappedSets
          : [{
            series: b.setsReps || '',
            exercise: b.nombreEj || '',
            weight: b.weight || '',
            placeholderExercise: '',
            exerciseId: null
          }]
      };

    case 'ROUNDS':
      return {
        rounds: b.cantRondas ?? '',
        descanso: b.descansoRonda ?? '',
        setsReps: mappedSets
      };

    case 'EMOM':
      return {
        interval: '1',
        totalMinutes: b.durationMin ?? '',
        setsReps: mappedSets
      };

    case 'AMRAP':
      return {
        duration: b.durationMin ?? '',
        setsReps: mappedSets
      };

    case 'LADDER':
      return {
        escaleraType: b.tipoEscalera ?? '',
        setsReps: mappedSets
      };

    case 'TABATA':
      return {
        cantSeries: b.cantSeries ?? '',
        descTabata: b.descTabata ?? '',
        tiempoTrabajoDescansoTabata:
          b.tiempoTrabajoDescansoTabata ??
          (b.durationMin ? `${b.durationMin}m` : ''),
        setsReps: mappedSets
      };

    case 'DROPSET': {
      // Por si en algún momento se guarda explícito como DROPSET
      const rows = items.length ? items : [];
      const first = rows[0] || {};
      return {
        exerciseName:
          b.nombreEj ??
          first?.ejercicio?.nombre ??
          first?.nombre ??
          '',
        exerciseId:
          first?.ejercicio?.ID_Ejercicio ??
          first?.ID_Ejercicio ??
          first?.ejercicioId ??
          null,
        exercisePlaceholder: '',
        setsReps: rows.map(e => ({
          series: e.reps ?? '',
          weight: e.setRepWeight ?? ''
        }))
      };
    }

    default:
      return { setsReps: mappedSets };
  }
};

// Normalizador de métricas
const normalizeUserMetrics = (resp) => {
  const ejercicios =
    (resp && Array.isArray(resp.ejercicios) && resp.ejercicios) ||
    (resp && resp.data && Array.isArray(resp.data.ejercicios) && resp.data.ejercicios) ||
    (Array.isArray(resp) && resp) ||
    [];
  return { ejercicios };
};

/* ================= Component ================= */
const CrearRutina = ({ fromAdmin, fromEntrenador, fromAlumno }) => {
  const { rutinaId } = useParams();
  const isEditing = Boolean(rutinaId);
  const navigate = useNavigate();

  const canAssign = !!(fromEntrenador || fromAdmin);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(isEditing);

  const [formData, setFormData] = useState({ nombre: '', descripcion: '' });
  const [clases, setClases] = useState([]);
  const [selectedClase, setSelectedClase] = useState("");
  const [selectedGrupoMuscular, setSelectedGrupoMuscular] = useState("");
  const gruposMusculares = [
    "Pecho", "Espalda", "Piernas", "Brazos", "Hombros",
    "Abdominales", "Glúteos", "Tren Superior", "Tren Inferior",
    "Full Body", "Mixto"
  ];

  const [users, setUsers] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);

  const [allExercises, setAllExercises] = useState([]);

  // Panel de información
  const [infoOpen, setInfoOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(max-width: 720px)').matches;
  });
  const [infoTab, setInfoTab] = useState('ejercicios');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [userMetrics, setUserMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Días
  const [days, setDays] = useState([
    { key: 'dia1', nombre: '', descripcion: '', blocks: [] }
  ]);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  // Semanas
  const [hasWeeks, setHasWeeks] = useState(false);
  const [weeks, setWeeks] = useState([
    {
      key: 'semana1',
      nombre: 'Semana 1',
      numero: 1,
      dias: [{ key: 'dia1', nombre: '', descripcion: '', blocks: [] }]
    }
  ]);
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);

  // Responsive
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    apiService.getEjercicios()
      .then(setAllExercises)
      .catch(() => toast.error('No se pudieron cargar los ejercicios'));

    apiService.getClases()
      .then(setClases)
      .catch(() => toast.error('No se pudieron cargar las clases'));
  }, []);

  useEffect(() => {
    if (step === 2) setInfoOpen(!isMobile);
  }, [step, isMobile]);

  useEffect(() => {
    if (canAssign) {
      (async () => {
        try {
          const clientes = await fetchAllClientsActive(apiService, { take: 100 });
          setUsers(clientes);
        } catch {
          toast.error('No se pudieron cargar todos los usuarios');
        }
      })();
    }
  }, [canAssign]);

  useEffect(() => {
    if (isEditing && (!canAssign || users.length > 0)) {
      fetchRoutine();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, canAssign, users]);

  const selectedUserId = useMemo(() => {
    if (!canAssign) return Number(localStorage.getItem("usuarioId"));
    const u = users.find(u => u.email === selectedEmail);
    return u?.ID_Usuario ?? null;
  }, [canAssign, users, selectedEmail]);

  useEffect(() => {
    if (!canAssign) return;
    if (!selectedUserId) { setUserMetrics(null); return; }
    if (!(step === 2 && infoTab === 'usuario')) return;

    (async () => {
      try {
        setLoadingMetrics(true);
        const resp = await apiService.getEjerciciosResultadosUsuario(selectedUserId);
        const normalized = normalizeUserMetrics(resp);
        setUserMetrics(normalized);
      } catch {
        setUserMetrics({ ejercicios: [] });
        toast.error('No se pudieron cargar las mediciones del usuario');
      } finally {
        setLoadingMetrics(false);
      }
    })();
  }, [canAssign, selectedUserId, step, infoTab]);

  const afterPaint = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );

  const cryptoRandomId = () => {
    try {
      return Number((crypto.getRandomValues(new Uint32Array(1))[0]).toString());
    } catch {
      return Date.now();
    }
  };

  const fetchRoutine = async () => {
    setLoading(true);
    try {
      const resp = await apiService.getRutinaById(rutinaId);
      const r = resp?.rutina ?? resp;

      setFormData({
        nombre: r.nombre || '',
        descripcion: r.desc || ''
      });
      setSelectedClase(r.claseRutina || "");
      setSelectedGrupoMuscular(r.grupoMuscularRutina || "");

      if (canAssign) {
        const alumnoEmail = r?.alumno?.email ?? r?.alumnoEmail ?? null;
        const alumnoId = r?.ID_Usuario ?? r?.alumno?.ID_Usuario ?? null;
        let selected = null;
        if (alumnoEmail) {
          selected = alumnoEmail;
        } else if (alumnoId) {
          const u = users.find(u => u.ID_Usuario === alumnoId);
          selected = u?.email ?? null;
        }
        setSelectedEmail(selected);
      }

      const mapBloques = (list) => {
        if (!Array.isArray(list)) return [];
        return list.map(b => {
          const converted = convertApiBlockData(b);
          const isDrop = converted.__isDropSet === true;
          const blockType = isDrop
            ? 'DROPSET'
            : (apiToDisplayType[b.type] || b.type);

          const data = isDrop
            ? {
              exerciseName: converted.exerciseName,
              exerciseId: converted.exerciseId,
              exercisePlaceholder: converted.exercisePlaceholder,
              setsReps: converted.setsReps
            }
            : converted;

          return {
            id: cryptoRandomId(),
            type: blockType,
            data
          };
        });
      };

      // Helper para parsear días de un objeto de días
      const parseDaysFromObj = (diasObj) => {
        if (!diasObj) return [];
        const keys = Object.keys(diasObj).sort();
        return keys.map((k, idx) => {
          const d = diasObj[k] || {};
          const blocks = Array.isArray(d.bloques)
            ? mapBloques(d.bloques)
            : [];
          return {
            key: `dia${idx + 1}`,
            nombre: d.nombre || '',
            descripcion: d.descripcion || '',
            blocks
          };
        });
      };

      if (r?.semanas && Object.keys(r.semanas).length > 0) {
        // WITH WEEKS
        setHasWeeks(true);
        const wKeys = Object.keys(r.semanas).sort();
        const loadedWeeks = wKeys.map((wk, idx) => {
          const wData = r.semanas[wk];
          const daysParsed = parseDaysFromObj(wData.dias);
          return {
            key: `semana${idx + 1}`,
            nombre: wData.nombre || `Semana ${idx + 1}`,
            numero: wData.numero || (idx + 1),
            dias: daysParsed.length
              ? daysParsed
              : [{ key: 'dia1', nombre: '', descripcion: '', blocks: [] }]
          };
        });

        setWeeks(loadedWeeks);
        setActiveWeekIndex(0);
        setDays(loadedWeeks[0].dias);
        setActiveDayIndex(0);

      } else if (r?.dias && typeof r.dias === 'object') {
        // NO WEEKS (Old structure with 'dias' object)
        setHasWeeks(false);
        const loadedDays = parseDaysFromObj(r.dias);
        const finalDays = loadedDays.length
          ? loadedDays
          : [{ key: 'dia1', nombre: '', descripcion: '', blocks: [] }];

        setDays(finalDays);
        setActiveDayIndex(0);

        // Populate first week just in case they toggle "Has Weeks" ON
        setWeeks([{
          key: 'semana1',
          nombre: 'Semana 1',
          numero: 1,
          dias: finalDays
        }]);

      } else {
        // FLAT BLOCK LIST / LEGACY
        setHasWeeks(false);
        const blocks = Array.isArray(r.Bloques)
          ? mapBloques(r.Bloques)
          : [];
        const finalDays = [{
          key: 'dia1',
          nombre: '',
          descripcion: '',
          blocks
        }];
        setDays(finalDays);
        setActiveDayIndex(0);
        setWeeks([{
          key: 'semana1',
          nombre: 'Semana 1',
          numero: 1,
          dias: finalDays
        }]);
      }

      await afterPaint();

    } catch (err) {
      console.error(err);
      toast.error('No se pudo cargar la rutina para editar');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = (e) => {
    e.preventDefault();
    if (!formData.nombre.trim())
      return toast.error("Ingresá un nombre para la rutina");
    if (!days.length)
      return toast.error("Agregá al menos un día");
    if (fromEntrenador && !selectedEmail)
      return toast.error("Seleccioná un usuario para asignar la rutina");
    setStep(2);
  };

  /* ================= Weeks Logic ================= */
  const syncCurrentDaysToWeek = (currentWeeksState) => {
    // Updates the 'weeks' array at activeWeekIndex with the current 'days' state
    const newWeeks = [...currentWeeksState];
    if (newWeeks[activeWeekIndex]) {
      newWeeks[activeWeekIndex] = {
        ...newWeeks[activeWeekIndex],
        dias: days
      };
    }
    return newWeeks;
  };

  const handleWeekChange = (newIndex) => {
    if (newIndex === activeWeekIndex) return;
    // 1. Sync current days to the OLD week
    const syncedWeeks = syncCurrentDaysToWeek(weeks);
    // 2. Set new active week
    setWeeks(syncedWeeks);
    setActiveWeekIndex(newIndex);
    // 3. Load active week days into view
    const nextWeekDays = syncedWeeks[newIndex]?.dias || [];
    setDays(nextWeekDays.length ? nextWeekDays : [{ key: 'dia1', nombre: '', descripcion: '', blocks: [] }]);
    setActiveDayIndex(0);
  };

  const addWeek = () => {
    // Sync first
    const syncedWeeks = syncCurrentDaysToWeek(weeks);
    const nextNum = syncedWeeks.length + 1;
    const newWeek = {
      key: `semana${nextNum}`,
      nombre: `Semana ${nextNum}`,
      numero: nextNum,
      dias: [{ key: 'dia1', nombre: '', descripcion: '', blocks: [] }]
    };
    const newWeeksList = [...syncedWeeks, newWeek];
    setWeeks(newWeeksList);
    // Switch to new week
    setActiveWeekIndex(newWeeksList.length - 1);
    setDays(newWeek.dias);
    setActiveDayIndex(0);
  };

  const removeWeek = (idx) => {
    if (weeks.length <= 1) return toast.info("Debe haber al menos una semana");
    // If we are removing the active week, we need care
    // If removing other week, just remove it from array

    let currentWeeks = [...weeks];
    // If removing current view's week, no need to sync `days` to it, it's gonna be deleted.
    // However if removing ANOTHER week, we should sync current days to current week just in case.
    if (idx !== activeWeekIndex) {
      currentWeeks = syncCurrentDaysToWeek(currentWeeks);
    }

    const filtered = currentWeeks.filter((_, i) => i !== idx);
    // Re-assign keys/numbers
    const remapped = filtered.map((w, i) => ({
      ...w,
      key: `semana${i + 1}`,
      numero: i + 1,
      nombre: w.nombre.startsWith('Semana ') ? `Semana ${i + 1}` : w.nombre
    }));

    setWeeks(remapped);

    // If we removed the active week
    if (idx === activeWeekIndex) {
      const newIdx = Math.max(0, idx - 1);
      setActiveWeekIndex(newIdx);
      setDays(remapped[newIdx].dias);
      setActiveDayIndex(0);
    } else if (idx < activeWeekIndex) {
      // If we removed a week BEFORE active, shift active index left
      setActiveWeekIndex(activeWeekIndex - 1);
    }
  };

  const toggleHasWeeks = () => {
    const newValue = !hasWeeks;
    setHasWeeks(newValue);
    if (newValue) {
      // Enabled weeks: Sync current days to week 1 (already aligned if we kept sync, but ensure it)
      const w = [...weeks];
      w[0].dias = days;
      // Also ensure we only have 1 week if it was fresh? Or keep existing?
      // "weeks" state tracks weeks, so we just continue using it.
      setWeeks(w);
      if (weeks.length === 0) {
        // Should not happen, but safeguard
        setWeeks([{
          key: 'semana1',
          nombre: 'Semana 1',
          numero: 1,
          dias: days
        }]);
      }
    } else {
      // Disabled weeks: We only care about current active week's days?
      // Or should we flatten?
      // Requirement: "se puede enviar el post tanto con semanas como sin semanas"
      // Usually if I toggle OFF weeks, I likely only want to keep the content of the CURRENT week (or Week 1).
      // Let's just keep 'days' as is (which is the currently viewed week).
      // The payload builder will ignore 'weeks' array and just use 'days'.
    }
  };

  const addDay = () => {
    const nextIndex = days.length + 1;
    const newKey = `dia${nextIndex}`;
    setDays([
      ...days,
      { key: newKey, nombre: '', descripcion: '', blocks: [] }
    ]);
    setActiveDayIndex(days.length);
  };

  const removeDay = (idx) => {
    if (days.length === 1)
      return toast.info("Debe existir al menos un día");
    const newDays = days
      .filter((_, i) => i !== idx)
      .map((d, i) => ({ ...d, key: `dia${i + 1}` }));
    setDays(newDays);
    setActiveDayIndex(Math.max(0, idx - 1));
  };

  const activeDay = days[activeDayIndex];

  const setActiveDayBlocks = (newBlocks) => {
    setDays(days.map((d, i) =>
      i === activeDayIndex ? { ...d, blocks: newBlocks } : d
    ));
  };

  const addExerciseIntoBuildingBlock = (exerciseObj) => {
    const ejName = exerciseObj?.nombre || '';
    const ejId = exerciseObj?.ID_Ejercicio || null;

    if (!activeDay?.blocks || activeDay.blocks.length === 0) {
      const newBlock = makeEmptyBlock('Series y repeticiones');
      newBlock.data.setsReps = [{
        series: '',
        exercise: ejName,
        weight: '',
        placeholderExercise: getRandomExercise(),
        exerciseId: ejId
      }];
      setActiveDayBlocks([newBlock]);
      toast.success(`Agregado "${ejName}" en un nuevo bloque`);
      return;
    }

    const lastIndex = activeDay.blocks.length - 1;
    const lastBlock = activeDay.blocks[lastIndex];

    if (lastBlock?.type === 'DROPSET') {
      const updated = {
        ...lastBlock,
        data: {
          ...lastBlock.data,
          exerciseName: ejName,
          exerciseId: ejId ?? null
        }
      };
      const newBlocks = activeDay.blocks.map((b, i) =>
        i === lastIndex ? updated : b
      );
      setActiveDayBlocks(newBlocks);
      toast.success(`Asignado "${ejName}" al DROPSET`);
      return;
    }

    const currentSets = Array.isArray(lastBlock?.data?.setsReps)
      ? lastBlock.data.setsReps
      : [];
    const updatedLastBlock = {
      ...lastBlock,
      data: {
        ...lastBlock.data,
        setsReps: [
          ...currentSets,
          {
            series: '',
            exercise: ejName,
            weight: '',
            placeholderExercise: getRandomExercise(),
            exerciseId: ejId
          }
        ]
      }
    };

    const newBlocks = activeDay.blocks.map((b, i) =>
      i === lastIndex ? updatedLastBlock : b
    );
    setActiveDayBlocks(newBlocks);
    toast.success(`Agregado "${ejName}" al último bloque`);
  };

  // Blocks CRUD
  const handleAddBlock = (e) => {
    const selectedType = e.target.value;
    if (!selectedType) return;
    setActiveDayBlocks([
      ...(activeDay?.blocks || []),
      makeEmptyBlock(selectedType)
    ]);
  };

  const handleDeleteBlock = (blockId) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).filter(b => b.id !== blockId)
    );
  };

  const handleBlockFieldChange = (blockId, field, value) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block =>
        block.id === blockId
          ? { ...block, data: { ...block.data, [field]: value } }
          : block
      )
    );
  };

  const handleSetRepChange = (blockId, index, field, value) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block => {
        if (block.id === blockId) {
          const newSetsReps = block.data.setsReps.map((sr, i) =>
            i === index ? { ...sr, [field]: value } : sr
          );
          return {
            ...block,
            data: { ...block.data, setsReps: newSetsReps }
          };
        }
        return block;
      })
    );
  };

  const handleAddSetRep = (blockId) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block =>
        block.id === blockId
          ? {
            ...block,
            data: {
              ...block.data,
              setsReps: [
                ...block.data.setsReps,
                block.type === 'DROPSET'
                  ? { series: '', weight: '' }
                  : {
                    series: '',
                    exercise: '',
                    weight: '',
                    placeholderExercise: getRandomExercise(),
                    exerciseId: null
                  }
              ]
            }
          }
          : block
      )
    );
  };

  const handleDeleteSetRep = (blockId, index) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block =>
        block.id === blockId
          ? {
            ...block,
            data: {
              ...block.data,
              setsReps: block.data.setsReps.filter((_, i) => i !== index)
            }
          }
          : block
      )
    );
  };

  // Autocomplete helpers
  const [suggestions, setSuggestionsState] = useState({});
  const setSuggestions = setSuggestionsState;

  const handleExerciseInputChange = (blockId, idx, value) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block => {
        if (block.id === blockId) {
          const newSets = block.data.setsReps.map((sr, i) =>
            i === idx
              ? { ...sr, exercise: value, exerciseId: null }
              : sr
          );
          return {
            ...block,
            data: { ...block.data, setsReps: newSets }
          };
        }
        return block;
      })
    );

    const key = `${activeDay?.key || 'dia'}-${blockId}-${idx}`;
    if (value.trim() === '') {
      setSuggestions(prev => ({ ...prev, [key]: [] }));
      return;
    }

    const lista = Array.isArray(allExercises) ? allExercises : [];
    const filtered = lista
      .filter(e =>
        e.nombre?.toLowerCase?.().includes(value.trim().toLowerCase())
      )
      .slice(0, 5);
    setSuggestions(prev => ({ ...prev, [key]: filtered }));
  };

  const handleSelectSuggestion = (blockId, idx, exerciseObj) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block => {
        if (block.id === blockId) {
          const newSets = block.data.setsReps.map((sr, i) =>
            i === idx
              ? {
                ...sr,
                exercise: exerciseObj.nombre,
                exerciseId: exerciseObj.ID_Ejercicio
              }
              : sr
          );
          return {
            ...block,
            data: { ...block.data, setsReps: newSets }
          };
        }
        return block;
      })
    );
    const key = `${activeDay?.key || 'dia'}-${blockId}-${idx}`;
    setSuggestions(prev => ({ ...prev, [key]: [] }));
  };

  // Autocomplete para nombre en DROPSET
  const handleDropsetNameChange = (blockId, value) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block =>
        block.id === blockId
          ? {
            ...block,
            data: {
              ...block.data,
              exerciseName: value,
              exerciseId: null
            }
          }
          : block
      )
    );

    const key = `${activeDay?.key || 'dia'}-${blockId}-dropsetname`;
    if (value.trim() === '') {
      setSuggestions(prev => ({ ...prev, [key]: [] }));
      return;
    }

    const lista = Array.isArray(allExercises) ? allExercises : [];
    const filtered = lista
      .filter(e =>
        e.nombre?.toLowerCase?.().includes(value.trim().toLowerCase())
      )
      .slice(0, 5);
    setSuggestions(prev => ({ ...prev, [key]: filtered }));
  };

  const handleSelectDropsetName = (blockId, exerciseObj) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block =>
        block.id === blockId
          ? {
            ...block,
            data: {
              ...block.data,
              exerciseName: exerciseObj.nombre,
              exerciseId: exerciseObj.ID_Ejercicio
            }
          }
          : block
      )
    );
    const key = `${activeDay?.key || 'dia'}-${blockId}-dropsetname`;
    setSuggestions(prev => ({ ...prev, [key]: [] }));
  };

  // Drag & drop de bloques
  const [draggingBlockId, setDraggingBlockId] = useState(null);
  const [dragOverBlockId, setDragOverBlockId] = useState(null);

  const onDragStart = (e, blockId) => {
    setDraggingBlockId(blockId);
    e.dataTransfer.setData('text/plain', String(blockId));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e, overId) => {
    e.preventDefault();
    setDragOverBlockId(overId);
  };
  const onDrop = (e, toId) => {
    e.preventDefault();
    const fromId = Number(e.dataTransfer.getData('text/plain'));
    if (!fromId || fromId === toId) {
      setDraggingBlockId(null);
      setDragOverBlockId(null);
      return;
    }
    const list = activeDay?.blocks || [];
    const fromIndex = list.findIndex(b => b.id === fromId);
    const toIndex = list.findIndex(b => b.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const newOrder = [...list];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    setActiveDayBlocks(newOrder);
    setDraggingBlockId(null);
    setDragOverBlockId(null);
  };
  const onDragEnd = () => {
    setDraggingBlockId(null);
    setDragOverBlockId(null);
  };

  // Drag & drop de DÍAS (tabs) - con drop "entre" tabs
  const [draggingDayKey, setDraggingDayKey] = useState(null);
  const [dayDropIndex, setDayDropIndex] = useState(null); // 0..days.length

  const onDayDragStart = (e, dayKey) => {
    setDraggingDayKey(dayKey);
    setDayDropIndex(null);
    e.dataTransfer.setData('text/plain', String(dayKey));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDayDragOverTab = (e, overIndex) => {
    e.preventDefault();
    if (!draggingDayKey) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const isBefore = e.clientX < rect.left + rect.width / 2;
    setDayDropIndex(isBefore ? overIndex : overIndex + 1);
  };

  const onDayDragOverContainer = (e) => {
    e.preventDefault();
    if (!draggingDayKey) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const nearRight = e.clientX > rect.right - 12;
    if (nearRight) setDayDropIndex(days.length);
  };

  const onDayDrop = (e) => {
    e.preventDefault();

    const fromKey = e.dataTransfer.getData('text/plain');
    if (!fromKey) return;

    const dropIndexRaw = typeof dayDropIndex === 'number' ? dayDropIndex : null;
    if (dropIndexRaw == null) {
      setDraggingDayKey(null);
      setDayDropIndex(null);
      return;
    }

    const fromIndex = days.findIndex(d => d.key === fromKey);
    if (fromIndex === -1) return;

    const dropIndexClamped = Math.max(0, Math.min(dropIndexRaw, days.length));

    const list = [...days];
    const activeKey = days[activeDayIndex]?.key;

    const [moved] = list.splice(fromIndex, 1);

    let insertIndex = dropIndexClamped;
    if (fromIndex < insertIndex) insertIndex -= 1;

    insertIndex = Math.max(0, Math.min(insertIndex, list.length));
    list.splice(insertIndex, 0, moved);

    const newActiveIndex =
      activeKey === fromKey
        ? insertIndex
        : Math.max(0, list.findIndex(d => d.key === activeKey));

    const renumbered = list.map((d, i) => ({ ...d, key: `dia${i + 1}` }));

    setDays(renumbered);
    setActiveDayIndex(newActiveIndex);

    setDraggingDayKey(null);
    setDayDropIndex(null);
  };

  const onDayDragEnd = () => {
    setDraggingDayKey(null);
    setDayDropIndex(null);
  };


  // Payload
  const buildPayload = () => {
    const userId = canAssign
      ? (users.find(u => u.email === selectedEmail)?.ID_Usuario ?? null)
      : Number(localStorage.getItem("usuarioId"));

    const entrenadorId = canAssign
      ? Number(localStorage.getItem("usuarioId"))
      : null;

    // Helper to format a single "Day" object for API
    const formatDay = (dayObj, dayIndex) => {
      const key = `dia${dayIndex + 1}`;
      const bloques = [];

      (dayObj.blocks || []).forEach(block => {
        const type = displayToApiType(block.type);

        // DROPSET → se guarda como SETS_REPS con múltiples filas mismo ejercicio
        if (type === 'DROPSET') {
          const name = (block?.data?.exerciseName || '').trim();
          const ejId = block?.data?.exerciseId ?? null;
          const rows = Array.isArray(block?.data?.setsReps)
            ? block.data.setsReps
            : [];

          const bloqueEjercicios = rows.map(sr => {
            const reps = sr?.series || '';
            const weightNorm = (sr?.weight || '').trim();
            if (ejId) {
              return {
                ejercicioId: ejId,
                reps,
                setRepWeight: weightNorm || undefined
              };
            }
            return {
              nuevoEjercicio: { nombre: name || 'Ejercicio' },
              reps,
              setRepWeight: weightNorm || undefined
            };
          });

          const first = rows[0] || {};
          const firstReps = first.series || null;
          const firstWeight = (first.weight || '').trim() || null;

          bloques.push({
            type: 'SETS_REPS',
            setsReps: firstReps,
            nombreEj: name || null,
            weight: firstWeight,
            descansoRonda: null,
            bloqueEjercicios
          });

          return;
        }

        // Resto de tipos
        const bloqueEjercicios = (block.data.setsReps || []).map(setRep => {
          const normWeight = (setRep.weight || '').trim();
          if (setRep.exerciseId) {
            return {
              ejercicioId: setRep.exerciseId,
              reps: setRep.series,
              setRepWeight: normWeight || undefined
            };
          }
          return {
            nuevoEjercicio: { nombre: setRep.exercise },
            reps: setRep.series,
            setRepWeight: normWeight || undefined
          };
        });

        switch (type) {
          case 'SETS_REPS':
            bloques.push({
              type,
              setsReps: block.data.setsReps[0]?.series || null,
              nombreEj: block.data.setsReps[0]?.exercise || null,
              weight:
                (block.data.setsReps[0]?.weight || '').trim() || null,
              descansoRonda: block.data.descanso || null,
              bloqueEjercicios
            });
            break;

          case 'ROUNDS':
            bloques.push({
              type,
              cantRondas:
                parseInt(block.data.rounds || 0, 10) || null,
              descansoRonda:
                parseInt(block.data.descanso || 0, 10) || null,
              bloqueEjercicios
            });
            break;

          case 'EMOM':
            bloques.push({
              type,
              durationMin:
                parseInt(block.data.totalMinutes || 0, 10) || null,
              bloqueEjercicios
            });
            break;

          case 'AMRAP':
            bloques.push({
              type,
              durationMin:
                parseInt(block.data.duration || 0, 10) || null,
              bloqueEjercicios
            });
            break;

          case 'LADDER':
            bloques.push({
              type,
              tipoEscalera:
                (block.data.escaleraType || '').trim() || null,
              bloqueEjercicios
            });
            break;

          case 'TABATA':
            bloques.push({
              type,
              cantSeries: Number.isFinite(
                parseInt(block.data.cantSeries, 10)
              )
                ? parseInt(block.data.cantSeries, 10)
                : null,
              descTabata:
                (block.data.descTabata || '').trim() || null,
              tiempoTrabajoDescansoTabata:
                (block.data.tiempoTrabajoDescansoTabata || '').trim() ||
                null,
              bloqueEjercicios
            });
            break;

          default:
            bloques.push({ type, bloqueEjercicios });
        }
      });

      return {
        key,
        data: {
          nombre: dayObj.nombre || `Día ${dayIndex + 1}`,
          descripcion: dayObj.descripcion || '',
          bloques
        }
      };
    };


    if (!hasWeeks) {
      // Legacy / simple structure
      const diasObj = {};
      days.forEach((d, i) => {
        const { key, data } = formatDay(d, i);
        diasObj[key] = data;
      });

      return {
        ID_Usuario: userId,
        ID_Entrenador: entrenadorId,
        nombre: formData.nombre,
        desc: formData.descripcion,
        claseRutina: selectedClase || "Combinada",
        grupoMuscularRutina: selectedGrupoMuscular || "Mixto",
        dias: diasObj
      };
    } else {
      // With Weeks
      // First ensure active days are sync'ed
      const finalWeeks = syncCurrentDaysToWeek(weeks);
      const semanasObj = {};

      finalWeeks.forEach((w, wkIdx) => {
        const wkKey = `semana${wkIdx + 1}`;
        const wkDaysObj = {};
        (w.dias || []).forEach((d, dIdx) => {
          const { key, data } = formatDay(d, dIdx);
          wkDaysObj[key] = data;
        });

        semanasObj[wkKey] = {
          nombre: w.nombre || `Semana ${wkIdx + 1}`,
          numero: wkIdx + 1,
          dias: wkDaysObj
        };
      });

      return {
        ID_Usuario: userId,
        ID_Entrenador: entrenadorId,
        nombre: formData.nombre,
        desc: formData.descripcion,
        claseRutina: selectedClase || "Combinada",
        grupoMuscularRutina: selectedGrupoMuscular || "Mixto",
        semanas: semanasObj
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = buildPayload();

      if (isEditing) {
        await apiService.editRutina(rutinaId, payload);
        toast.success('Rutina actualizada correctamente');
      } else {
        await apiService.createRutina(payload);
        toast.success('Rutina creada correctamente');
      }

      if (fromAdmin) navigate('/admin/rutinas-asignadas');
      if (fromEntrenador) navigate('/entrenador/rutinas-asignadas');
      if (fromAlumno) navigate('/alumno/mi-rutina');
    } catch {
      toast.error(
        isEditing
          ? 'Error actualizando rutina'
          : 'Error creando rutina'
      );
    } finally {
      setLoading(false);
    }
  };

  // Responsive / panel info
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 720px)');
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    try {
      mql.addEventListener('change', handler);
    } catch {
      mql.addListener(handler);
    }
    return () => {
      try {
        mql.removeEventListener('change', handler);
      } catch {
        mql.removeListener(handler);
      }
    };
  }, []);

  useEffect(() => {
    if (!(isMobile && infoOpen)) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setInfoOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, infoOpen]);

  useEffect(() => {
    if (isMobile && infoOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isMobile, infoOpen]);

  // Derivados UI
  const filteredExercises = useMemo(() => {
    const term = exerciseSearch.trim().toLowerCase();
    if (!term) return allExercises;
    return (allExercises || []).filter(e =>
      e?.nombre?.toLowerCase?.().includes(term)
    );
  }, [exerciseSearch, allExercises]);

  const selectedUser = useMemo(() => {
    if (!canAssign) return null;
    return (
      users.find(u => u.ID_Usuario === selectedUserId) || null
    );
  }, [canAssign, users, selectedUserId]);

  /* ================= Render ================= */
  return (
    <div className='page-layout'>
      {loading && <LoaderFullScreen />}
      <SidebarMenu
        isAdmin={fromAdmin}
        isEntrenador={fromEntrenador}
      />

      <div
        className='content-layout mi-rutina-ctn layout-with-info'
        style={{ display: 'flex', gap: 16 }}
      >
        {/* FAB abrir info en mobile */}
        {canAssign && step === 2 && isMobile && !infoOpen && (
          <button
            className="fab-info"
            onClick={() => setInfoOpen(true)}
            aria-label="Abrir información"
            aria-controls="info-panel"
            aria-expanded={infoOpen}
          >
            Información útil
          </button>
        )}

        {/* Columna principal */}
        <div
          className="main-col"
          style={{ flex: '1 1 auto', minWidth: 0 }}
        >
          <div
            className="mi-rutina-title header-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8
            }}
          >
            <h2>
              {isEditing ? 'Editar Rutina' : 'Crear Rutina'}
            </h2>

            {step === 2 && (
              <PrimaryButton
                text={
                  isEditing
                    ? "Guardar cambios"
                    : "Crear rutina"
                }
                linkTo="#"
                onClick={handleSubmit}
              />
            )}
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="crear-rutina-step1">
              <div className="crear-rutina-step-1-form">
                <CustomInput
                  placeholder="Nombre de la rutina"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nombre: e.target.value
                    })
                  }
                />

                <CustomDropdown
                  id="claseRutina"
                  name="claseRutina"
                  placeholderOption="Seleccionar clase (opcional)"
                  options={clases.map(c => c.nombre)}
                  value={selectedClase}
                  onChange={e =>
                    setSelectedClase(e.target.value)
                  }
                />

                <CustomDropdown
                  id="grupoMuscular"
                  name="grupoMuscular"
                  placeholderOption="Seleccionar grupo muscular (opcional)"
                  options={gruposMusculares}
                  value={selectedGrupoMuscular}
                  onChange={e =>
                    setSelectedGrupoMuscular(
                      e.target.value
                    )
                  }
                />

                <CustomInput
                  placeholder="Descripción (opcional)"
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      descripcion: e.target.value
                    })
                  }
                />

                {canAssign && (
                  <Select
                    options={users.map(u => ({
                      label: `${u.nombre} ${u.apellido} (${u.email})`,
                      value: u.email
                    }))}
                    value={
                      selectedEmail
                        ? {
                          label: `${users.find(
                            u =>
                              u.email ===
                              selectedEmail
                          )?.nombre || ''} ${users.find(
                            u =>
                              u.email ===
                              selectedEmail
                          )?.apellido || ''} (${selectedEmail})`,
                          value: selectedEmail
                        }
                        : null
                    }
                    onChange={option =>
                      setSelectedEmail(option.value)
                    }
                    placeholder="Seleccioná un usuario"
                    isSearchable
                    required={!!fromEntrenador}
                  />
                )}

                <div className='crearRutina-s1-continuar-btn-ctn'>
                  <PrimaryButton
                    text="Continuar"
                    linkTo="#"
                    onClick={handleContinue}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="crear-rutina-step2">
              <div className="crear-rutina-step-2-form">
                <SecondaryButton
                  text="← Volver"
                  linkTo="#"
                  onClick={() => setStep(1)}
                  style={{ marginBottom: '16px' }}
                />

                {/* Weeks Toggle */}
                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="hasWeeksToggle"
                    checked={hasWeeks}
                    onChange={toggleHasWeeks}
                    style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                  />
                  <label htmlFor="hasWeeksToggle" style={{ cursor: 'pointer', userSelect: 'none', fontWeight: 500 }}>
                    Organizar por semanas
                  </label>
                </div>

                {/* Weeks Tabs */}
                {/* Weeks Tabs */}
                {hasWeeks && (
                  <div className="days-tabs">
                    {weeks.map((w, idx) => (
                      <div
                        key={w.key}
                        className={`day-tab ${idx === activeWeekIndex ? 'active' : ''}`}
                        onClick={() => handleWeekChange(idx)}
                      >
                        <span className="day-tab-label">{`Semana ${idx + 1}`}</span>
                        <button
                          className="day-tab-close"
                          title="Eliminar semana"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeWeek(idx);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      className="day-tab add"
                      onClick={addWeek}
                      type="button"
                    >
                      + Semana
                    </button>
                  </div>
                )}

                {/* Tabs días (reordenables) */}
                <div
                  className="days-tabs"
                  onDragOver={onDayDragOverContainer}
                  onDrop={onDayDrop}
                >
                  {days.map((d, idx) => {
                    const isDragging = draggingDayKey === d.key;

                    return (
                      <React.Fragment key={d.key}>
                        {draggingDayKey && dayDropIndex === idx && (
                          <div className="day-drop-indicator" />
                        )}

                        <div
                          className={`day-tab ${idx === activeDayIndex ? 'active' : ''} ${isDragging ? 'day-tab--dragging' : ''}`}
                          onClick={() => setActiveDayIndex(idx)}
                          onDragOver={(e) => onDayDragOverTab(e, idx)}
                          onDrop={onDayDrop}
                          onDragEnd={onDayDragEnd}
                        >
                          <button
                            className="day-drag-handle"
                            draggable
                            onDragStart={(e) => onDayDragStart(e, d.key)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Reordenar día"
                            title="Arrastrar para reordenar"
                            type="button"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M4 7h16v2H4zM4 11h16v2H4zM4 15h16v2H4z"></path>
                            </svg>
                          </button>

                          <span className="day-tab-label">{`Día ${idx + 1}`}</span>

                          <button
                            className="day-tab-close"
                            title="Eliminar día"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeDay(idx);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </React.Fragment>
                    );
                  })}

                  {draggingDayKey && dayDropIndex === days.length && (
                    <div className="day-drop-indicator" />
                  )}

                  <button className="day-tab add" onClick={addDay} type="button">
                    + Añadir día
                  </button>
                </div>

                {/* Meta día */}
                <div className="day-meta">
                  <CustomInput
                    placeholder="Nombre del día (ej. Fuerza - Día 1)"
                    value={activeDay?.nombre || ''}
                    onChange={(e) =>
                      setDays(
                        days.map((d, i) =>
                          i === activeDayIndex
                            ? {
                              ...d,
                              nombre: e.target.value
                            }
                            : d
                        )
                      )
                    }
                  />
                  <CustomInput
                    placeholder="Descripción del día (opcional)"
                    value={activeDay?.descripcion || ''}
                    onChange={(e) =>
                      setDays(
                        days.map((d, i) =>
                          i === activeDayIndex
                            ? {
                              ...d,
                              descripcion:
                                e.target.value
                            }
                            : d
                        )
                      )
                    }
                  />
                </div>

                {/* Agregar bloque */}
                <div className='agregar-bloque-ctn'>
                  <p>Agregar bloque:</p>
                  <CustomDropdown
                    placeholderOption="Tipo de serie"
                    options={DISPLAY_TYPES}
                    value=""
                    onChange={handleAddBlock}
                  />
                </div>

                {/* Bloques */}
                {(activeDay?.blocks || []).map(
                  (block, idxBlock) => {
                    const isDragging =
                      draggingBlockId === block.id;
                    const isOver =
                      dragOverBlockId === block.id;
                    const sugKeyPrefix = `${activeDay?.key || 'dia'
                      }-${block.id}-`;

                    return (
                      <div
                        key={block.id ?? idxBlock}
                        className={`block-container ${isDragging
                          ? 'block--dragging'
                          : ''
                          } ${isOver ? 'block--over' : ''
                          }`}
                        onDragOver={(e) =>
                          onDragOver(e, block.id)
                        }
                        onDrop={(e) =>
                          onDrop(e, block.id)
                        }
                        onDragEnd={onDragEnd}
                      >
                        <div className="block-actions">
                          <button
                            className="drag-handle"
                            draggable
                            onDragStart={(e) =>
                              onDragStart(e, block.id)
                            }
                            aria-label="Reordenar bloque"
                            title="Arrastrar para reordenar"
                          >
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M4 7h16v2H4zM4 11h16v2H4zM4 15h16v2H4z"></path>
                            </svg>
                          </button>

                          <button
                            onClick={() =>
                              handleDeleteBlock(block.id)
                            }
                            className="delete-block-btn"
                            title="Eliminar bloque"
                          >
                            <CloseIcon
                              width={32}
                              height={32}
                            />
                          </button>
                        </div>

                        <h4 className="block-title">
                          {block.type}
                        </h4>

                        {/* SERIES Y REPETICIONES */}
                        {block.type ===
                          "Series y repeticiones" && (
                            <div className="sets-reps-ctn">
                              {block.data.setsReps.map(
                                (setRep, idx) => (
                                  <div
                                    key={idx}
                                    className="sets-row"
                                  >
                                    <input
                                      type="text"
                                      className="series-input"
                                      placeholder="ej. 5x5"
                                      value={
                                        setRep.series
                                      }
                                      onChange={e =>
                                        handleSetRepChange(
                                          block.id,
                                          idx,
                                          'series',
                                          e.target.value
                                        )
                                      }
                                    />
                                    <div className="exercise-cell">
                                      <input
                                        type="text"
                                        className="exercise-input"
                                        placeholder={
                                          setRep.placeholderExercise
                                        }
                                        value={
                                          setRep.exercise
                                        }
                                        onChange={e =>
                                          handleExerciseInputChange(
                                            block.id,
                                            idx,
                                            e.target.value
                                          )
                                        }
                                      />
                                      {(suggestions[
                                        `${sugKeyPrefix}${idx}`
                                      ] || [])
                                        .length >
                                        0 && (
                                          <ul className="suggestions-list">
                                            {suggestions[
                                              `${sugKeyPrefix}${idx}`
                                            ].map(
                                              ex => (
                                                <li
                                                  key={
                                                    ex.ID_Ejercicio
                                                  }
                                                  onClick={() =>
                                                    handleSelectSuggestion(
                                                      block.id,
                                                      idx,
                                                      ex
                                                    )
                                                  }
                                                >
                                                  {
                                                    ex.nombre
                                                  }
                                                </li>
                                              )
                                            )}
                                          </ul>
                                        )}
                                    </div>
                                    <input
                                      type="text"
                                      className="weight-input"
                                      placeholder="ej. 30kg"
                                      value={
                                        setRep.weight
                                      }
                                      onChange={e =>
                                        handleSetRepChange(
                                          block.id,
                                          idx,
                                          'weight',
                                          e.target.value
                                        )
                                      }
                                      aria-label="Peso"
                                    />
                                    <button
                                      onClick={() =>
                                        handleDeleteSetRep(
                                          block.id,
                                          idx
                                        )
                                      }
                                      className="delete-set-btn"
                                      title="Eliminar este set"
                                    >
                                      –
                                    </button>
                                  </div>
                                )
                              )}
                              <PrimaryButton
                                text="+"
                                linkTo="#"
                                onClick={() =>
                                  handleAddSetRep(
                                    block.id
                                  )
                                }
                              />
                            </div>
                          )}

                        {/* RONDAS */}
                        {block.type ===
                          "Rondas" && (
                            <div className="rondas-ctn">
                              <div className="cantidad-rondas-descanso">
                                <div className='cant-rondas-subctn'>
                                  <input
                                    className='cant-rondas-subctn-input-chico'
                                    placeholder="3"
                                    value={
                                      block.data
                                        .rounds
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'rounds',
                                        e.target.value
                                      )
                                    }
                                  />
                                  <span>
                                    {' '}
                                    rondas con{' '}
                                  </span>
                                </div>
                                <div className='cant-rondas-subctn'>
                                  <input
                                    className='cant-rondas-subctn-input-chico'
                                    placeholder="90"
                                    value={
                                      block.data
                                        .descanso
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'descanso',
                                        e.target.value
                                      )
                                    }
                                  />
                                  <span>
                                    {' '}
                                    segundos de
                                    descanso{' '}
                                  </span>
                                </div>
                              </div>

                              <div className="sets-reps-ctn">
                                {block.data.setsReps.map(
                                  (setRep, idx) => (
                                    <div
                                      key={idx}
                                      className="sets-row"
                                    >
                                      <input
                                        type="text"
                                        className="series-input"
                                        placeholder="ej. 3x12"
                                        value={
                                          setRep.series
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'series',
                                            e.target.value
                                          )
                                        }
                                      />
                                      <div className="exercise-cell">
                                        <input
                                          type="text"
                                          className="exercise-input"
                                          placeholder={
                                            setRep.placeholderExercise
                                          }
                                          value={
                                            setRep.exercise
                                          }
                                          onChange={e =>
                                            handleExerciseInputChange(
                                              block.id,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                        />
                                        {(suggestions[
                                          `${sugKeyPrefix}${idx}`
                                        ] || [])
                                          .length >
                                          0 && (
                                            <ul className="suggestions-list">
                                              {suggestions[
                                                `${sugKeyPrefix}${idx}`
                                              ].map(
                                                ex => (
                                                  <li
                                                    key={
                                                      ex.ID_Ejercicio
                                                    }
                                                    onClick={() =>
                                                      handleSelectSuggestion(
                                                        block.id,
                                                        idx,
                                                        ex
                                                      )
                                                    }
                                                  >
                                                    {
                                                      ex.nombre
                                                    }
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          )}
                                      </div>
                                      <input
                                        type="text"
                                        className="weight-input"
                                        placeholder="-"
                                        value={
                                          setRep.weight
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'weight',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Peso"
                                      />
                                      <button
                                        onClick={() =>
                                          handleDeleteSetRep(
                                            block.id,
                                            idx
                                          )
                                        }
                                        className="delete-set-btn"
                                        title="Eliminar este set"
                                      >
                                        –
                                      </button>
                                    </div>
                                  )
                                )}
                                <PrimaryButton
                                  text="+"
                                  linkTo="#"
                                  onClick={() =>
                                    handleAddSetRep(
                                      block.id
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                        {/* EMOM */}
                        {block.type ===
                          "EMOM" && (
                            <div className="emom-ctn">
                              <div className="cantidad-emom-ctn">
                                <div className='cant-rondas-subctn'>
                                  <span>
                                    {' '}
                                    Cada{' '}
                                  </span>
                                  <input
                                    className='cant-rondas-subctn-input-chico'
                                    placeholder="1"
                                    value={
                                      block.data
                                        .interval
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'interval',
                                        e.target.value
                                      )
                                    }
                                  />
                                  <input
                                    className='cant-rondas-subctn-input-grande'
                                    placeholder="minuto"
                                    disabled
                                  />
                                </div>
                                <div className='cant-rondas-subctn'>
                                  <span>
                                    {' '}
                                    por{' '}
                                  </span>
                                  <input
                                    className='cant-rondas-subctn-input-chico'
                                    placeholder="20"
                                    value={
                                      block.data
                                        .totalMinutes
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'totalMinutes',
                                        e.target.value
                                      )
                                    }
                                  />
                                  <input
                                    className='cant-rondas-subctn-input-grande'
                                    placeholder="minutos"
                                    disabled
                                  />
                                </div>
                              </div>

                              <div className="sets-reps-ctn">
                                {block.data.setsReps.map(
                                  (setRep, idx) => (
                                    <div
                                      key={idx}
                                      className="sets-row"
                                    >
                                      <input
                                        type="text"
                                        className="series-input"
                                        placeholder="ej. 10"
                                        value={
                                          setRep.series
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'series',
                                            e.target.value
                                          )
                                        }
                                      />
                                      <div className="exercise-cell">
                                        <input
                                          type="text"
                                          className="exercise-input"
                                          placeholder={
                                            setRep.placeholderExercise
                                          }
                                          value={
                                            setRep.exercise
                                          }
                                          onChange={e =>
                                            handleExerciseInputChange(
                                              block.id,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                        />
                                        {(suggestions[
                                          `${sugKeyPrefix}${idx}`
                                        ] || [])
                                          .length >
                                          0 && (
                                            <ul className="suggestions-list">
                                              {suggestions[
                                                `${sugKeyPrefix}${idx}`
                                              ].map(
                                                ex => (
                                                  <li
                                                    key={
                                                      ex.ID_Ejercicio
                                                    }
                                                    onClick={() =>
                                                      handleSelectSuggestion(
                                                        block.id,
                                                        idx,
                                                        ex
                                                      )
                                                    }
                                                  >
                                                    {
                                                      ex.nombre
                                                    }
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          )}
                                      </div>
                                      <input
                                        type="text"
                                        className="weight-input"
                                        placeholder="-"
                                        value={
                                          setRep.weight
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'weight',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Peso"
                                      />
                                      <button
                                        onClick={() =>
                                          handleDeleteSetRep(
                                            block.id,
                                            idx
                                          )
                                        }
                                        className="delete-set-btn"
                                        title="Eliminar este set"
                                      >
                                        –
                                      </button>
                                    </div>
                                  )
                                )}
                                <PrimaryButton
                                  text="+"
                                  linkTo="#"
                                  onClick={() =>
                                    handleAddSetRep(
                                      block.id
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                        {/* AMRAP */}
                        {block.type ===
                          "AMRAP" && (
                            <div className="amrap-ctn">
                              <div className="cantidad-amrap-ctn">
                                <span>
                                  {' '}
                                  AMRAP de{' '}
                                </span>
                                <input
                                  className='cant-rondas-subctn-input-chico'
                                  placeholder="20"
                                  value={
                                    block.data
                                      .duration
                                  }
                                  onChange={(e) =>
                                    handleBlockFieldChange(
                                      block.id,
                                      'duration',
                                      e.target.value
                                    )
                                  }
                                />
                                <input
                                  className='cant-rondas-subctn-input-grande'
                                  placeholder="minutos"
                                  disabled
                                />
                              </div>

                              <div className="sets-reps-ctn">
                                {block.data.setsReps.map(
                                  (setRep, idx) => (
                                    <div
                                      key={idx}
                                      className="sets-row"
                                    >
                                      <input
                                        type="text"
                                        className="series-input"
                                        placeholder="ej. 12"
                                        value={
                                          setRep.series
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'series',
                                            e.target.value
                                          )
                                        }
                                      />
                                      <div className="exercise-cell">
                                        <input
                                          type="text"
                                          className="exercise-input"
                                          placeholder={
                                            setRep.placeholderExercise
                                          }
                                          value={
                                            setRep.exercise
                                          }
                                          onChange={e =>
                                            handleExerciseInputChange(
                                              block.id,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                        />
                                        {(suggestions[
                                          `${sugKeyPrefix}${idx}`
                                        ] || [])
                                          .length >
                                          0 && (
                                            <ul className="suggestions-list">
                                              {suggestions[
                                                `${sugKeyPrefix}${idx}`
                                              ].map(
                                                ex => (
                                                  <li
                                                    key={
                                                      ex.ID_Ejercicio
                                                    }
                                                    onClick={() =>
                                                      handleSelectSuggestion(
                                                        block.id,
                                                        idx,
                                                        ex
                                                      )
                                                    }
                                                  >
                                                    {
                                                      ex.nombre
                                                    }
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          )}
                                      </div>
                                      <input
                                        type="text"
                                        className="weight-input"
                                        placeholder="-"
                                        value={
                                          setRep.weight
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'weight',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Peso"
                                      />
                                      <button
                                        onClick={() =>
                                          handleDeleteSetRep(
                                            block.id,
                                            idx
                                          )
                                        }
                                        className="delete-set-btn"
                                        title="Eliminar este set"
                                      >
                                        –
                                      </button>
                                    </div>
                                  )
                                )}
                                <PrimaryButton
                                  text="+"
                                  linkTo="#"
                                  onClick={() =>
                                    handleAddSetRep(
                                      block.id
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                        {/* ESCALERA */}
                        {block.type ===
                          "Escalera" && (
                            <div className="escalera-ctn">
                              <div className="cantidad-escalera-ctn">
                                <input
                                  className='cant-rondas-subctn-input-grande'
                                  placeholder="Ej. 21-15-9"
                                  value={
                                    block.data
                                      .escaleraType
                                  }
                                  onChange={(e) =>
                                    handleBlockFieldChange(
                                      block.id,
                                      'escaleraType',
                                      e.target.value
                                    )
                                  }
                                />
                              </div>

                              <div className="sets-reps-ctn">
                                {block.data.setsReps.map(
                                  (setRep, idx) => (
                                    <div
                                      key={idx}
                                      className="sets-ladder sets-row--no-series"
                                    >
                                      <div
                                        className="exercise-cell"
                                        style={{
                                          width:
                                            '100%'
                                        }}
                                      >
                                        <input
                                          style={{
                                            width:
                                              '100%'
                                          }}
                                          type="text"
                                          className="exercise-input"
                                          placeholder={
                                            setRep.placeholderExercise
                                          }
                                          value={
                                            setRep.exercise
                                          }
                                          onChange={e =>
                                            handleExerciseInputChange(
                                              block.id,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                        />
                                        {(suggestions[
                                          `${sugKeyPrefix}${idx}`
                                        ] || [])
                                          .length >
                                          0 && (
                                            <ul className="suggestions-list">
                                              {suggestions[
                                                `${sugKeyPrefix}${idx}`
                                              ].map(
                                                ex => (
                                                  <li
                                                    key={
                                                      ex.ID_Ejercicio
                                                    }
                                                    onClick={() =>
                                                      handleSelectSuggestion(
                                                        block.id,
                                                        idx,
                                                        ex
                                                      )
                                                    }
                                                  >
                                                    {
                                                      ex.nombre
                                                    }
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          )}
                                      </div>
                                      <input
                                        type="text"
                                        className="weight-input"
                                        placeholder="ej. 24kg"
                                        value={
                                          setRep.weight
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'weight',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Peso"
                                      />
                                      <button
                                        onClick={() =>
                                          handleDeleteSetRep(
                                            block.id,
                                            idx
                                          )
                                        }
                                        className="delete-set-btn"
                                        title="Eliminar este set"
                                      >
                                        –
                                      </button>
                                    </div>
                                  )
                                )}
                                <PrimaryButton
                                  text="+"
                                  linkTo="#"
                                  onClick={() =>
                                    handleAddSetRep(
                                      block.id
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                        {/* TABATA */}
                        {block.type ===
                          "TABATA" && (
                            <div className="tabata-ctn">
                              <div
                                className="cantidad-tabata-ctn"
                                style={{
                                  display: 'flex',
                                  gap: 12,
                                  flexWrap:
                                    'wrap',
                                  alignItems:
                                    'center'
                                }}
                              >
                                <div className='cant-rondas-subctn'>
                                  <span>
                                    Series:{' '}
                                  </span>
                                  <input
                                    className='cant-rondas-subctn-input-chico'
                                    placeholder="4"
                                    value={
                                      block.data
                                        .cantSeries
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'cantSeries',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div className='cant-rondas-subctn'>
                                  <span>
                                    Trabajo/descanso:{' '}
                                  </span>
                                  <input
                                    className='cant-rondas-subctn-input-grande'
                                    placeholder='ej. 20s x 10s'
                                    value={
                                      block.data
                                        .tiempoTrabajoDescansoTabata
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'tiempoTrabajoDescansoTabata',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div className='cant-rondas-subctn'>
                                  <span>
                                    Descanso entre
                                    series:{' '}
                                  </span>
                                  <input
                                    className='cant-rondas-subctn-input-grande'
                                    placeholder='ej. 1 minuto'
                                    value={
                                      block.data
                                        .descTabata
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'descTabata',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                              </div>

                              <div className="sets-reps-ctn">
                                {block.data.setsReps.map(
                                  (setRep, idx) => (
                                    <div
                                      key={idx}
                                      className="sets-row sets-row--no-series"
                                    >
                                      <div
                                        className="exercise-cell"
                                        style={{
                                          width:
                                            '100%'
                                        }}
                                      >
                                        <input
                                          type="text"
                                          className="exercise-input"
                                          style={{
                                            width:
                                              '100%'
                                          }}
                                          placeholder={
                                            setRep.placeholderExercise
                                          }
                                          value={
                                            setRep.exercise
                                          }
                                          onChange={e =>
                                            handleExerciseInputChange(
                                              block.id,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                        />
                                        {(suggestions[
                                          `${sugKeyPrefix}${idx}`
                                        ] || [])
                                          .length >
                                          0 && (
                                            <ul className="suggestions-list">
                                              {suggestions[
                                                `${sugKeyPrefix}${idx}`
                                              ].map(
                                                ex => (
                                                  <li
                                                    key={
                                                      ex.ID_Ejercicio
                                                    }
                                                    onClick={() =>
                                                      handleSelectSuggestion(
                                                        block.id,
                                                        idx,
                                                        ex
                                                      )
                                                    }
                                                  >
                                                    {
                                                      ex.nombre
                                                    }
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          )}
                                      </div>
                                      <input
                                        type="text"
                                        className="weight-input"
                                        placeholder="ej. 16kg"
                                        value={
                                          setRep.weight
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'weight',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Peso"
                                      />
                                      <button
                                        onClick={() =>
                                          handleDeleteSetRep(
                                            block.id,
                                            idx
                                          )
                                        }
                                        className="delete-set-btn"
                                        title="Eliminar este ejercicio"
                                      >
                                        –
                                      </button>
                                    </div>
                                  )
                                )}
                                <PrimaryButton
                                  text="+"
                                  linkTo="#"
                                  onClick={() =>
                                    handleAddSetRep(
                                      block.id
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                        {/* DROPSET */}
                        {block.type ===
                          "DROPSET" && (
                            <div className="dropset-ctn">
                              <div
                                className="exercise-cell"
                                style={{
                                  width:
                                    '100%',
                                  marginBottom: 12
                                }}
                              >
                                <input
                                  type="text"
                                  className="exercise-input"
                                  style={{
                                    width:
                                      '100%'
                                  }}
                                  placeholder={
                                    block.data
                                      .exercisePlaceholder ||
                                    'Nombre ejercicio'
                                  }
                                  value={
                                    block.data
                                      .exerciseName ||
                                    ''
                                  }
                                  onChange={(e) =>
                                    handleDropsetNameChange(
                                      block.id,
                                      e.target.value
                                    )
                                  }
                                />
                                {(suggestions[
                                  `${activeDay?.key || 'dia'}-${block.id}-dropsetname`
                                ] || []).length >
                                  0 && (
                                    <ul className="suggestions-list">
                                      {suggestions[
                                        `${activeDay?.key || 'dia'}-${block.id}-dropsetname`
                                      ].map(
                                        ex => (
                                          <li
                                            key={
                                              ex.ID_Ejercicio
                                            }
                                            onClick={() =>
                                              handleSelectDropsetName(
                                                block.id,
                                                ex
                                              )
                                            }
                                          >
                                            {
                                              ex.nombre
                                            }
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  )}
                              </div>

                              <div className="sets-reps-ctn">
                                {block.data.setsReps.map(
                                  (sr, idx) => (
                                    <div
                                      key={idx}
                                      className="sets-row sets-row--dropset"
                                    >
                                      <div
                                        className="series-group"
                                        style={{
                                          display:
                                            'flex',
                                          gap: 8,
                                          width:
                                            '100%'
                                        }}
                                      >
                                        <div
                                          style={{
                                            flex: 1
                                          }}
                                        >
                                          <label className="mini-label">
                                            Serie y
                                            reps
                                          </label>
                                          <input
                                            type="text"
                                            className="series-input"
                                            placeholder="Ej. 2×20"
                                            value={
                                              sr.series
                                            }
                                            onChange={e =>
                                              handleSetRepChange(
                                                block.id,
                                                idx,
                                                'series',
                                                e.target.value
                                              )
                                            }
                                          />
                                        </div>
                                        <div
                                          style={{
                                            flex: 1
                                          }}
                                        >
                                          <label className="mini-label">
                                            Kilos
                                          </label>
                                          <input
                                            type="text"
                                            className="weight-input"
                                            placeholder="Ej. 50kg"
                                            value={
                                              sr.weight
                                            }
                                            onChange={e =>
                                              handleSetRepChange(
                                                block.id,
                                                idx,
                                                'weight',
                                                e.target.value
                                              )
                                            }
                                          />
                                        </div>
                                      </div>
                                      <button
                                        onClick={() =>
                                          handleDeleteSetRep(
                                            block.id,
                                            idx
                                          )
                                        }
                                        className="delete-set-btn"
                                        title="Eliminar fila"
                                      >
                                        –
                                      </button>
                                    </div>
                                  )
                                )}
                                <PrimaryButton
                                  text="+"
                                  linkTo="#"
                                  onClick={() =>
                                    handleAddSetRep(
                                      block.id
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>

        {/* Panel lateral info */}
        {canAssign && step === 2 && (
          <>
            <div
              className={`info-backdrop ${isMobile && infoOpen
                ? 'show'
                : ''
                }`}
              onClick={() =>
                setInfoOpen(false)
              }
              aria-hidden={!isMobile || !infoOpen}
            />
            <aside
              id="info-panel"
              className={`info-panel ${isMobile ? 'drawer' : ''
                } ${infoOpen ? 'open' : ''}`}
              role={isMobile ? 'dialog' : undefined}
              aria-modal={isMobile ? 'true' : undefined}
              aria-label="Información contextual"
            >
              <div className="info-panel__header">
                <h3>Información</h3>
                <button
                  type="button"
                  onClick={() =>
                    setInfoOpen(false)
                  }
                  className="info-panel__close"
                  title="Cerrar panel"
                  aria-label="Cerrar panel"
                >
                  ×
                </button>
              </div>

              <div className="info-panel__content">
                <div className="info-tabs">
                  <button
                    className={`info-tab ${infoTab ===
                      'ejercicios'
                      ? 'active'
                      : ''
                      }`}
                    onClick={() =>
                      setInfoTab('ejercicios')
                    }
                  >
                    Ejercicios
                  </button>
                  <button
                    className={`info-tab ${infoTab ===
                      'usuario'
                      ? 'active'
                      : ''
                      }`}
                    onClick={() =>
                      setInfoTab('usuario')
                    }
                  >
                    Información del
                    usuario
                  </button>
                </div>

                {infoTab ===
                  'ejercicios' && (
                    <div>
                      <input
                        type="text"
                        className="info-search"
                        placeholder="Buscar ejercicio..."
                        value={
                          exerciseSearch
                        }
                        onChange={(e) =>
                          setExerciseSearch(
                            e.target.value
                          )
                        }
                      />
                      <div className="info-list">
                        {(filteredExercises ||
                          []).map(
                            (ej) => (
                              <div
                                key={
                                  ej.ID_Ejercicio
                                }
                                className="info-card"
                              >
                                <div className="info-card__row">
                                  <strong className="info-card__title">
                                    {
                                      ej.nombre
                                    }
                                  </strong>
                                  <div
                                    style={{
                                      display:
                                        'flex',
                                      gap: 8,
                                      alignItems:
                                        'center'
                                    }}
                                  >
                                    <PrimaryButton
                                      className="info-card__add"
                                      onClick={() =>
                                        addExerciseIntoBuildingBlock(
                                          ej
                                        )
                                      }
                                      text="Agregar"
                                    />
                                  </div>
                                </div>
                                {ej.descripcion && (
                                  <p className="info-card__desc">
                                    {
                                      ej.descripcion
                                    }
                                  </p>
                                )}
                                <div className="info-card__meta">
                                  {ej.musculos && (
                                    <small>
                                      <b>
                                        Músculos:
                                      </b>{' '}
                                      {
                                        ej.musculos
                                      }
                                    </small>
                                  )}
                                  {ej.equipamiento && (
                                    <small>
                                      <b>
                                        Equipo:
                                      </b>{' '}
                                      {
                                        ej.equipamiento
                                      }
                                    </small>
                                  )}
                                  {ej.youtubeUrl && (
                                    <a
                                      href={
                                        ej.youtubeUrl
                                      }
                                      target="_blank"
                                      rel="noreferrer"
                                      className="info-card__link"
                                    >
                                      YouTube
                                    </a>
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        {(!filteredExercises ||
                          filteredExercises.length ===
                          0) && (
                            <p className="info-empty">
                              No se
                              encontraron
                              ejercicios.
                            </p>
                          )}
                      </div>
                    </div>
                  )}

                {infoTab ===
                  'usuario' && (
                    <div>
                      <div className="user-meta">
                        <div className="user-meta__line">
                          <b>
                            Usuario
                            asignado:
                          </b>{' '}
                          {selectedUserId
                            ? `${selectedUser?.nombre || ''} ${selectedUser?.apellido || ''}`
                            : '— seleccioná un usuario'}
                        </div>
                      </div>

                      {!selectedUserId && (
                        <p className="info-empty">
                          Para ver
                          mediciones, primero
                          seleccioná un
                          usuario en el
                          desplegable de la
                          izquierda.
                        </p>
                      )}

                      {selectedUserId && (
                        <>
                          {loadingMetrics && (
                            <p className="info-loading">
                              Cargando
                              mediciones...
                            </p>
                          )}

                          {!loadingMetrics &&
                            (!userMetrics ||
                              !Array.isArray(
                                userMetrics.ejercicios
                              ) ||
                              userMetrics
                                .ejercicios
                                .length ===
                              0) && (
                              <p className="info-empty">
                                Sin datos de
                                mediciones.
                              </p>
                            )}

                          {!loadingMetrics &&
                            Array.isArray(
                              userMetrics?.ejercicios
                            ) &&
                            userMetrics
                              .ejercicios
                              .length >
                            0 && (
                              <div className="metrics-list">
                                {userMetrics.ejercicios.map(
                                  (e) => {
                                    const historico =
                                      Array.isArray(
                                        e.HistoricoEjercicios
                                      )
                                        ? [
                                          ...e.HistoricoEjercicios
                                        ]
                                        : [];
                                    historico.sort(
                                      (a, b) =>
                                        new Date(
                                          b.Fecha
                                        ) -
                                        new Date(
                                          a.Fecha
                                        )
                                    );
                                    const last3 =
                                      historico.slice(
                                        0,
                                        3
                                      );

                                    let pr =
                                      null;
                                    for (const h of historico) {
                                      if (
                                        !pr ||
                                        h.Cantidad >
                                        pr.Cantidad
                                      ) {
                                        pr =
                                          h;
                                      }
                                    }

                                    return (
                                      <div
                                        key={
                                          e.ID_EjercicioMedicion
                                        }
                                        className="info-card"
                                      >
                                        <div className="info-card__row">
                                          <strong className="info-card__title">
                                            {
                                              e.nombre
                                            }
                                          </strong>
                                          <small className="info-card__badge">
                                            {
                                              e.tipoMedicion
                                            }
                                          </small>
                                        </div>

                                        {last3.length >
                                          0 ? (
                                          <div className="metric-block">
                                            <div className="metric-block__title">
                                              Últimos 3
                                              registros
                                            </div>
                                            <ul className="metric-history">
                                              {last3.map(
                                                h => (
                                                  <li
                                                    key={
                                                      h.ID_HistoricoEjercicio
                                                    }
                                                  >
                                                    <span className="metric-date">
                                                      {new Date(
                                                        h.Fecha
                                                      ).toLocaleDateString()}
                                                    </span>
                                                    <span className="metric-sep">
                                                      —
                                                    </span>
                                                    <span className="metric-value">
                                                      {
                                                        h.Cantidad
                                                      }
                                                    </span>
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          </div>
                                        ) : (
                                          <div className="metric-block metric-block--empty">
                                            Sin
                                            registros
                                          </div>
                                        )}

                                        <div className="metric-block metric-block--pr">
                                          <span className="metric-pr-label">
                                            PR
                                            histórico:
                                          </span>
                                          {pr ? (
                                            <span className="metric-pr-value">
                                              {
                                                pr.Cantidad
                                              }{' '}
                                              <span className="metric-pr-date">
                                                (
                                                {new Date(
                                                  pr.Fecha
                                                ).toLocaleDateString()}
                                                )
                                              </span>
                                            </span>
                                          ) : (
                                            <span className="metric-pr-value">
                                              —
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            )}
                        </>
                      )}
                    </div>
                  )}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
};

export default CrearRutina;