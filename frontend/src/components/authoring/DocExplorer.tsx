/**
 * Phase 20: Document Explorer
 * Tree view of documents by type/ref/version
 */

import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, File, Folder, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface DocumentNode {
  id: string;
  name: string;
  type: string;
  version?: string;
  status: 'draft' | 'published' | 'archived';
  lastModified: string;
  children?: DocumentNode[];
}

interface DocExplorerProps {
  documents: DocumentNode[];
  selectedDoc?: string;
  onSelectDoc: (docId: string) => void;
  onCreateDoc: (type: string, parentId?: string) => void;
  onSearch: (query: string) => void;
}

export function DocExplorer({
  documents,
  selectedDoc,
  onSelectDoc,
  onCreateDoc,
  onSearch,
}: DocExplorerProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentNode[]>(documents);

  useEffect(() => {
    if (searchQuery) {
      const filtered = filterDocuments(documents, searchQuery);
      setFilteredDocuments(filtered);
    } else {
      setFilteredDocuments(documents);
    }
  }, [documents, searchQuery]);

  const filterDocuments = (docs: DocumentNode[], query: string): DocumentNode[] => {
    return docs.reduce((acc: DocumentNode[], doc) => {
      const matchesQuery = doc.name.toLowerCase().includes(query.toLowerCase()) ||
                          doc.type.toLowerCase().includes(query.toLowerCase());
      
      if (matchesQuery) {
        acc.push(doc);
      }
      
      if (doc.children) {
        const filteredChildren = filterDocuments(doc.children, query);
        if (filteredChildren.length > 0) {
          acc.push({
            ...doc,
            children: filteredChildren,
          });
        }
      }
      
      return acc;
    }, []);
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'published': return 'bg-green-100 text-green-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'world': return '🌍';
      case 'adventure': return '⚔️';
      case 'quest_graph': return '🗺️';
      case 'items': return '⚔️';
      case 'recipes': return '📜';
      case 'loot': return '💰';
      case 'vendors': return '🏪';
      case 'npc_personality': return '👤';
      case 'localization': return '🌐';
      case 'sim_config': return '⚙️';
      default: return '📄';
    }
  };

  const renderNode = (node: DocumentNode, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedDoc === node.id;

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer ${
            isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : ''
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleNode(node.id);
            } else {
              onSelectDoc(node.id);
            }
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )
          ) : (
            <div className="w-4 h-4" />
          )}
          
          <span className="text-lg">{getTypeIcon(node.type)}</span>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{node.name}</span>
              <Badge className={`text-xs ${getStatusColor(node.status)}`}>
                {node.status}
              </Badge>
              {node.version && (
                <Badge variant="outline" className="text-xs">
                  v{node.version}
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-500 truncate">
              {node.type} • {new Date(node.lastModified).toLocaleDateString()}
            </div>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-semibold">Documents</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCreateDoc('world')}
          >
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onSearch(e.target.value);
            }}
            className="pl-10"
          />
        </div>
      </div>
      
      {/* Document Tree */}
      <div className="flex-1 overflow-y-auto">
        {filteredDocuments.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? 'No documents match your search' : 'No documents found'}
          </div>
        ) : (
          <div>
            {filteredDocuments.map(node => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  );
}


