'use client';

interface FileIconProps {
  fileName?: string;
  isDirectory?: boolean;
  className?: string;
}

export default function FileIcon({ fileName, isDirectory, className = 'w-5 h-5' }: FileIconProps) {
  // Handle undefined fileName
  if (!fileName) {
    return (
      <div className={`${className} text-gray-500 dark:text-gray-400`}>
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    );
  }

  if (isDirectory) {
    return (
      <div className={`${className} text-yellow-500 dark:text-yellow-400`}>
        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
        </svg>
      </div>
    );
  }

  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Office documents - Check first to avoid conflicts
  // Word Documents - Blue
  if (['doc', 'docx'].includes(extension)) {
    return (
      <div className={`${className} text-blue-600 dark:text-blue-400`}>
        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          <path d="M8,12H16V13.5H8V12M8,14.5H13V16H8V14.5Z" />
        </svg>
      </div>
    );
  }

  // Excel - Green
  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return (
      <div className={`${className} text-green-600 dark:text-green-400`}>
        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          <path d="M8,12H16V13.5H8V12M8,14.5H16V16H8V14.5M8,17H13V18.5H8V17Z" />
        </svg>
      </div>
    );
  }

  // PowerPoint - Orange
  if (['ppt', 'pptx'].includes(extension)) {
    return (
      <div className={`${className} text-orange-600 dark:text-orange-400`}>
        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          <path d="M8,12H16V13.5H8V12M8,14.5H16V16H8V14.5M8,17H13V18.5H8V17Z" />
        </svg>
      </div>
    );
  }

  // OpenDocument formats
  if (['odt', 'ods', 'odp'].includes(extension)) {
    return (
      <div className={`${className} text-blue-500 dark:text-blue-400`}>
        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
        </svg>
      </div>
    );
  }

  // PDF - Red
  if (extension === 'pdf') {
    return (
      <div className={`${className} text-red-600 dark:text-red-400`}>
        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
        </svg>
      </div>
    );
  }

  // Images - Use photo/image icon
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff'].includes(extension)) {
    return (
      <div className={`${className} text-blue-500 dark:text-blue-400`}>
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  // Video - Purple
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v'].includes(extension)) {
    return (
      <div className={`${className} text-purple-600 dark:text-purple-400`}>
        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z" />
        </svg>
      </div>
    );
  }

  // Audio - Blue
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'].includes(extension)) {
    return (
      <div className={`${className} text-blue-600 dark:text-blue-400`}>
        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,3H10A1,1 0 0,0 9,4V20A1,1 0 0,0 10,21H14A1,1 0 0,0 15,20V4A1,1 0 0,0 14,3M19,3H16.5V15.5C16.5,18.53 14.03,21 11,21C7.97,21 5.5,18.53 5.5,15.5C5.5,12.47 7.97,10 11,10C12.15,10 13.3,10.35 14.25,11H19V3Z" />
        </svg>
      </div>
    );
  }

  // Archive - Brown/Amber
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(extension)) {
    return (
      <div className={`${className} text-amber-600 dark:text-amber-400`}>
        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20,6H16L14,4H10L8,6H4A2,2 0 0,0 2,8V19A2,2 0 0,0 4,21H20A2,2 0 0,0 22,19V8A2,2 0 0,0 20,6M16,17H8V15H16V17M16,13H8V11H16V13M16,9H8V7H16V9Z" />
        </svg>
      </div>
    );
  }

  // Code files - Yellow/Orange
  if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'sass', 'less', 'json', 'xml', 'yaml', 'yml'].includes(extension)) {
    return (
      <div className={`${className} text-yellow-600 dark:text-yellow-400`}>
        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6Z" />
        </svg>
      </div>
    );
  }

  // Text files - Gray
  if (['txt', 'md', 'markdown', 'rtf'].includes(extension)) {
    return (
      <div className={`${className} text-gray-600 dark:text-gray-400`}>
        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
        </svg>
      </div>
    );
  }

  // Default file icon - Gray
  return (
    <div className={`${className} text-gray-500 dark:text-gray-400`}>
      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
      </svg>
    </div>
  );
}

