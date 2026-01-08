import { useState, useRef } from 'react';
import { PageLayout } from '../components/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Upload, FileVideo, Clock, CheckCircle, XCircle, Trash2, FolderOpen, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription } from '../components/ui/alert';

interface UploadFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'completed' | 'failed';
  uploadDate: string;
  type: string;
}

interface HistoryFile {
  id: string;
  name: string;
  size: number;
  uploadDate: string;
  status: 'completed' | 'processing' | 'available';
  type: string;
  assignedTo?: string;
}

// Mock history data
const initialHistory: HistoryFile[] = [
  {
    id: 'h1',
    name: 'VFX_Sequence_001.exr',
    size: 2500000000,
    uploadDate: '2024-12-25 14:30',
    status: 'available',
    type: 'EXR Sequence',
    assignedTo: 'RENDER-01',
  },
  {
    id: 'h2',
    name: 'Raw_Footage_Scene_12.mov',
    size: 15000000000,
    uploadDate: '2024-12-24 10:15',
    status: 'available',
    type: 'Video',
    assignedTo: 'EDIT-01',
  },
  {
    id: 'h3',
    name: 'Comp_Project_Final.nk',
    size: 450000000,
    uploadDate: '2024-12-23 16:45',
    status: 'processing',
    type: 'Nuke Project',
  },
  {
    id: 'h4',
    name: 'Paint_Assets_Pack.zip',
    size: 8900000000,
    uploadDate: '2024-12-22 09:20',
    status: 'completed',
    type: 'Archive',
    assignedTo: 'PAINT-01',
  },
];

export function DataUploadPage() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState<UploadFile[]>([]);
  const [history, setHistory] = useState<HistoryFile[]>(initialHistory);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1073741824) {
      return (bytes / 1073741824).toFixed(2) + ' GB';
    } else if (bytes >= 1048576) {
      return (bytes / 1048576).toFixed(2) + ' MB';
    }
    return (bytes / 1024).toFixed(2) + ' KB';
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const newUpload: UploadFile = {
        id: `upload-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'uploading',
        uploadDate: new Date().toISOString(),
        type: file.type || 'Unknown',
      };

      setUploading((prev) => [...prev, newUpload]);
      simulateUpload(newUpload.id);
    });

    toast.success(`Started uploading ${files.length} file(s)`);
  };

  const simulateUpload = (id: string) => {
    const interval = setInterval(() => {
      setUploading((prev) =>
        prev.map((file) => {
          if (file.id === id && file.status === 'uploading') {
            const newProgress = Math.min(file.progress + Math.random() * 15, 100);
            if (newProgress >= 100) {
              clearInterval(interval);
              setTimeout(() => completeUpload(id), 500);
              return { ...file, progress: 100, status: 'completed' as const };
            }
            return { ...file, progress: newProgress };
          }
          return file;
        })
      );
    }, 500);
  };

  const completeUpload = (id: string) => {
    const uploadedFile = uploading.find((f) => f.id === id);
    if (!uploadedFile) return;

    const historyEntry: HistoryFile = {
      id: `h${Date.now()}`,
      name: uploadedFile.name,
      size: uploadedFile.size,
      uploadDate: new Date().toLocaleString(),
      status: 'processing',
      type: uploadedFile.type,
    };

    setHistory((prev) => [historyEntry, ...prev]);
    setUploading((prev) => prev.filter((f) => f.id !== id));
    toast.success(`${uploadedFile.name} uploaded successfully`);
  };

  const removeUpload = (id: string) => {
    setUploading((prev) => prev.filter((f) => f.id !== id));
    toast.success('Upload cancelled');
  };

  const deleteHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
    toast.success('File deleted from history');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'available':
        return <CheckCircle className="w-4 h-4" />;
      case 'processing':
      case 'uploading':
        return <Clock className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'available':
        return 'bg-green-600 text-white';
      case 'processing':
      case 'uploading':
        return 'bg-yellow-500 text-white';
      case 'failed':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  const totalUploaded = history.length;
  const totalSize = history.reduce((sum, h) => sum + h.size, 0);

  return (
    <PageLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-2">Data Upload</h1>
      <p className="text-muted-foreground mb-4">Upload your VFX assets, footage, and project files</p>

      {/* Info Alert */}
      <Alert className="mb-8 border-gray-300 bg-gray-100">
        <Info className="h-4 w-4 text-gray-600" />
        <AlertDescription className="text-gray-800">
          All uploaded files will be automatically transferred to your home folder on your assigned machines. 
          Your data is private and only accessible by you.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Files</CardTitle>
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUploaded}</div>
            <p className="text-xs text-muted-foreground mt-1">Files in storage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Storage Used</CardTitle>
            <FileVideo className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFileSize(totalSize)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total data uploaded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Active Uploads</CardTitle>
            <Upload className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uploading.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently uploading</p>
          </CardContent>
        </Card>
      </div>

      {/* Upload Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            Select your VFX files, footage, or project assets to upload to the cloud
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-gray-400 bg-gray-100 hover:bg-gray-200 text-gray-700"
            variant="outline"
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8" />
              <span className="font-medium">Click to select files or drag and drop</span>
              <span className="text-sm text-muted-foreground">
                Supports all file types (EXR, MOV, NK, AEP, etc.)
              </span>
            </div>
          </Button>
        </CardContent>
      </Card>

      {/* Active Uploads */}
      {uploading.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Upload Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploading.map((file) => (
              <div key={file.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <FileVideo className="w-5 h-5 text-gray-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{Math.round(file.progress)}%</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUpload(file.id)}
                    >
                      <XCircle className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
                <Progress value={file.progress} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upload History */}
      <Card>
        <CardHeader>
          <CardTitle>Upload History</CardTitle>
          <CardDescription>View all your uploaded files and their current status</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileVideo className="w-4 h-4 text-muted-foreground" />
                      {file.name}
                    </div>
                  </TableCell>
                  <TableCell>{file.type}</TableCell>
                  <TableCell>{formatFileSize(file.size)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      {file.uploadDate}
                    </div>
                  </TableCell>
                  <TableCell>
                    {file.assignedTo ? (
                      <Badge className="bg-gray-600 text-white">{file.assignedTo}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(file.status)}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(file.status)}
                        {file.status.toUpperCase()}
                      </div>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteHistoryItem(file.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </div>
      </div>
    </PageLayout>
  );
}
