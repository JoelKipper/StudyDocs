export type Language = 'de' | 'en';

export const translations = {
  de: {
    // General
    appName: 'StudyDocs',
    loading: 'Laden...',
    error: 'Fehler',
    success: 'Erfolg',
    cancel: 'Abbrechen',
    confirm: 'Bestätigen',
    delete: 'Löschen',
    rename: 'Umbenennen',
    download: 'Herunterladen',
    upload: 'Hochladen',
    create: 'Erstellen',
    save: 'Speichern',
    close: 'Schließen',
    
    // File Manager
    newDirectory: 'Neues Verzeichnis',
    uploadFile: 'Datei hochladen',
    refresh: 'Aktualisieren',
    logout: 'Abmelden',
    settings: 'Einstellungen',
    back: 'Zurück',
    root: 'Root',
    
    // File Table
    name: 'Name',
    type: 'Typ',
    size: 'Größe',
    modified: 'Geändert',
    createdBy: 'Erstellt von',
    actions: 'Aktionen',
    file: 'Datei',
    directory: 'Ordner',
    noFiles: 'Keine Dateien in diesem Verzeichnis',
    selectAll: 'Alle auswählen',
    
    // File Operations
    deleteConfirm: 'Möchten Sie dieses Element wirklich löschen?',
    deleteConfirmMultiple: 'Möchten Sie diese Elemente wirklich löschen?',
    deleteWarning: 'Dies wird alle Inhalte im Verzeichnis löschen.',
    deleteWarningMultiple: 'Dies wird alle Inhalte in den Verzeichnissen löschen.',
    renamePrompt: 'Neuen Namen eingeben',
    fileDeleted: 'Datei gelöscht',
    fileRenamed: 'Erfolgreich umbenannt',
    fileMoved: 'verschoben',
    fileCopied: 'kopiert',
    fileDownloaded: 'heruntergeladen',
    errorDeleting: 'Fehler beim Löschen',
    errorRenaming: 'Fehler beim Umbenennen',
    errorDownloading: 'Fehler beim Download',
    errorUploading: 'Fehler beim Upload',
    errorMoving: 'Fehler beim Verschieben',
    errorCopying: 'Fehler beim Kopieren',
    
    // Upload
    uploading: 'Wird hochgeladen...',
    uploadSuccess: 'Datei erfolgreich hochgeladen',
    uploadError: 'Fehler beim Hochladen',
    replaceFile: 'Datei ersetzen?',
    replaceFileMessage: 'Die Datei existiert bereits. Möchten Sie sie ersetzen?',
    replaceFileWarning: 'Wenn Sie die Datei ersetzen, wird die alte Version überschrieben.',
    
    // Context Menu
    open: 'Öffnen',
    createDirectory: 'Neues Verzeichnis',
    createDirectoryHere: 'Hier neues Verzeichnis erstellen',
    share: 'Teilen',
    addToFavorites: 'Zu Favoriten hinzufügen',
    removeFromFavorites: 'Aus Favoriten entfernen',
    
    // Search
    search: 'Suchen',
    searchPlaceholder: 'Suchen... (Ctrl/Cmd + F)',
    clearSearch: 'Suche löschen',
    filters: 'Filter',
    resetFilters: 'Filter zurücksetzen',
    fileType: 'Dateityp',
    allTypes: 'Alle',
    filesOnly: 'Nur Dateien',
    directoriesOnly: 'Nur Ordner',
    fileSize: 'Dateigröße',
    minSize: 'Min (KB)',
    maxSize: 'Max (KB)',
    modifiedDate: 'Änderungsdatum',
    from: 'Von',
    to: 'Bis',
    searchResults: 'Suchergebnisse',
    noResults: 'Keine Ergebnisse gefunden',
    
    // Bulk Operations
    bulkDelete: 'Ausgewählte löschen',
    bulkDownload: 'Ausgewählte herunterladen',
    itemsSelected: 'Element(e) ausgewählt',
    itemsDeleted: 'Element(e) erfolgreich gelöscht',
    itemsDownloaded: 'Element(e) erfolgreich heruntergeladen',
    creatingZip: 'ZIP-Datei wird erstellt...',
    zipError: 'Fehler beim Erstellen der ZIP-Datei',
    noFilesToDownload: 'Keine Dateien zum Herunterladen gefunden',
    selectItemsToDownload: 'Elemente zum Herunterladen auswählen',
    selectItemsToDelete: 'Elemente zum Löschen auswählen',
    
    // Copy/Paste
    copied: 'kopiert',
    cut: 'ausgeschnitten',
    paste: 'Einfügen',
    itemsCopied: 'Element(e) kopiert',
    itemsCut: 'Element(e) ausgeschnitten',
    pasting: 'werden',
    itemsPasted: 'Element(e) erfolgreich',
    
    // Undo
    undo: 'Rückgängig',
    undoing: 'Rückgängig wird gemacht...',
    undoSuccess: 'rückgängig gemacht',
    undoNotSupported: 'Rückgängig für Löschungen wird noch nicht vollständig unterstützt',
    
    // Settings
    settingsTitle: 'Einstellungen',
    keyboardShortcuts: 'Tastenkürzel',
    language: 'Sprache',
    appearance: 'Erscheinungsbild',
    light: 'Hell',
    dark: 'Dunkel',
    system: 'System',
    german: 'Deutsch',
    english: 'Englisch',
    selectLanguage: 'Wählen Sie Ihre bevorzugte Sprache aus.',
    selectAppearance: 'Wählen Sie Ihr bevorzugtes Erscheinungsbild aus.',
    availableShortcuts: 'Verfügbare Tastenkürzel:',
    noThemeSelected: 'Kein Theme ausgewählt - Browser/System-Einstellung wird verwendet',
    
    // Keyboard Shortcuts
    shortcutSelectAll: 'Alle auswählen / Abwählen',
    shortcutCopy: 'Kopieren',
    shortcutCut: 'Ausschneiden',
    shortcutPaste: 'Einfügen',
    shortcutNewFolder: 'Neuer Ordner',
    shortcutUpload: 'Datei hochladen',
    shortcutUndo: 'Rückgängig',
    shortcutDelete: 'Ausgewählte Elemente löschen',
    shortcutRename: 'Umbenennen',
    shortcutOpen: 'Öffnen / In Ordner navigieren',
    shortcutNavigate: 'Durch Dateien navigieren',
    shortcutEnterFolder: 'In Ordner öffnen',
    shortcutGoUp: 'Ein Ordner-Level nach oben',
    shortcutSearch: 'Suche fokussieren',
    shortcutEscape: 'Abbrechen / Schließen',
    
    // File Tree
    cannotMoveIntoSelf: 'Ein Verzeichnis kann nicht in sich selbst verschoben werden',
    movedTo: 'wurde nach',
    moved: 'verschoben',
    
    // Errors
    notAuthenticated: 'Nicht authentifiziert',
    itemExists: 'Ein Element mit diesem Namen existiert bereits',
    invalidAction: 'Ungültige Aktion',
    serverError: 'Serverfehler',
    directoryError: 'Fehler beim Laden des Verzeichnisses',
    
    // Size formatting
    bytes: 'Bytes',
    kb: 'KB',
    mb: 'MB',
    gb: 'GB',
  },
  en: {
    // General
    appName: 'StudyDocs',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    rename: 'Rename',
    download: 'Download',
    upload: 'Upload',
    create: 'Create',
    save: 'Save',
    close: 'Close',
    
    // File Manager
    newDirectory: 'New Directory',
    uploadFile: 'Upload File',
    refresh: 'Refresh',
    logout: 'Logout',
    settings: 'Settings',
    back: 'Back',
    root: 'Root',
    
    // File Table
    name: 'Name',
    type: 'Type',
    size: 'Size',
    modified: 'Modified',
    createdBy: 'Created By',
    actions: 'Actions',
    file: 'File',
    directory: 'Directory',
    noFiles: 'No files in this directory',
    selectAll: 'Select All',
    
    // File Operations
    deleteConfirm: 'Do you really want to delete this item?',
    deleteConfirmMultiple: 'Do you really want to delete these items?',
    deleteWarning: 'This will delete all contents in the directory.',
    deleteWarningMultiple: 'This will delete all contents in the directories.',
    renamePrompt: 'Enter new name',
    fileDeleted: 'File deleted',
    fileRenamed: 'Successfully renamed',
    fileMoved: 'moved',
    fileCopied: 'copied',
    fileDownloaded: 'downloaded',
    errorDeleting: 'Error deleting',
    errorRenaming: 'Error renaming',
    errorDownloading: 'Error downloading',
    errorUploading: 'Error uploading',
    errorMoving: 'Error moving',
    errorCopying: 'Error copying',
    
    // Upload
    uploading: 'Uploading...',
    uploadSuccess: 'File successfully uploaded',
    uploadError: 'Error uploading',
    replaceFile: 'Replace File?',
    replaceFileMessage: 'The file already exists. Do you want to replace it?',
    replaceFileWarning: 'If you replace the file, the old version will be overwritten.',
    
    // Context Menu
    open: 'Open',
    createDirectory: 'New Directory',
    createDirectoryHere: 'Create new directory here',
    share: 'Share',
    addToFavorites: 'Add to Favorites',
    removeFromFavorites: 'Remove from Favorites',
    
    // Search
    search: 'Search',
    searchPlaceholder: 'Search... (Ctrl/Cmd + F)',
    clearSearch: 'Clear search',
    filters: 'Filters',
    resetFilters: 'Reset filters',
    fileType: 'File Type',
    allTypes: 'All',
    filesOnly: 'Files Only',
    directoriesOnly: 'Directories Only',
    fileSize: 'File Size',
    minSize: 'Min (KB)',
    maxSize: 'Max (KB)',
    modifiedDate: 'Modified Date',
    from: 'From',
    to: 'To',
    searchResults: 'Search Results',
    noResults: 'No results found',
    
    // Bulk Operations
    bulkDelete: 'Delete Selected',
    bulkDownload: 'Download Selected',
    itemsSelected: 'item(s) selected',
    itemsDeleted: 'item(s) successfully deleted',
    itemsDownloaded: 'item(s) successfully downloaded',
    creatingZip: 'Creating ZIP file...',
    zipError: 'Error creating ZIP file',
    noFilesToDownload: 'No files found to download',
    selectItemsToDownload: 'Select items to download',
    selectItemsToDelete: 'Select items to delete',
    
    // Copy/Paste
    copied: 'copied',
    cut: 'cut',
    paste: 'Paste',
    itemsCopied: 'item(s) copied',
    itemsCut: 'item(s) cut',
    pasting: 'being',
    itemsPasted: 'item(s) successfully',
    
    // Undo
    undo: 'Undo',
    undoing: 'Undoing...',
    undoSuccess: 'undone',
    undoNotSupported: 'Undo for deletions is not fully supported yet',
    
    // Settings
    settingsTitle: 'Settings',
    keyboardShortcuts: 'Keyboard Shortcuts',
    language: 'Language',
    appearance: 'Appearance',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    german: 'German',
    english: 'English',
    selectLanguage: 'Select your preferred language.',
    selectAppearance: 'Select your preferred appearance.',
    availableShortcuts: 'Available keyboard shortcuts:',
    noThemeSelected: 'No theme selected - Browser/System setting will be used',
    
    // Keyboard Shortcuts
    shortcutSelectAll: 'Select All / Deselect All',
    shortcutCopy: 'Copy',
    shortcutCut: 'Cut',
    shortcutPaste: 'Paste',
    shortcutNewFolder: 'New Folder',
    shortcutUpload: 'Upload File',
    shortcutUndo: 'Undo',
    shortcutDelete: 'Delete Selected Items',
    shortcutRename: 'Rename',
    shortcutOpen: 'Open / Navigate to Folder',
    shortcutNavigate: 'Navigate through files',
    shortcutEnterFolder: 'Enter folder',
    shortcutGoUp: 'Go up one folder level',
    shortcutSearch: 'Focus search',
    shortcutEscape: 'Cancel / Close',
    
    // File Tree
    cannotMoveIntoSelf: 'A directory cannot be moved into itself',
    movedTo: 'was moved to',
    moved: 'moved',
    
    // Errors
    notAuthenticated: 'Not authenticated',
    itemExists: 'An item with this name already exists',
    invalidAction: 'Invalid action',
    serverError: 'Server error',
    directoryError: 'Error loading directory',
    
    // Size formatting
    bytes: 'Bytes',
    kb: 'KB',
    mb: 'MB',
    gb: 'GB',
  },
} as const;

export function getTranslation(lang: Language, key: keyof typeof translations.de): string {
  return translations[lang][key] || translations.de[key] || key;
}

export function formatFileSize(bytes: number, lang: Language): string {
  const t = translations[lang];
  if (bytes < 1024) return `${bytes} ${t.bytes}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} ${t.kb}`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} ${t.mb}`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ${t.gb}`;
}

