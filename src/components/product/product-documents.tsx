'use client';

import React from 'react';

export interface ProductDocumentsProps {
    specifications?: any;
    documents?: { name: string; url: string; size?: string; type?: string }[];
}

export function ProductDocuments({ specifications, documents = [] }: ProductDocumentsProps) {
    let specsList: { key: string; value: React.ReactNode }[] = [];

    if (specifications) {
        if (Array.isArray(specifications)) {
            const parsed = specifications.map((s: any) => ({
                key: s.key || s.name || Object.keys(s)[0] || '',
                value: s.value || Object.values(s)[0] || '',
            })).filter((s: { key: string; value: any }) => s.key && s.value);
            specsList = [...specsList, ...parsed];
        } else if (typeof specifications === 'object' && specifications !== null) {
            const parsed = Object.entries(specifications)
                .filter(([key]) => key !== 'documents')
                .map(([key, value]) => ({
                    key,
                    value: String(value),
                }));
            specsList = [...specsList, ...parsed];
        }
    }

    const parsedDocuments = [...documents];
    
    // Extract explicitly parsed documents array if injected by crawler
    if (specifications && typeof specifications === 'object' && Array.isArray(specifications.documents)) {
        specifications.documents.forEach((doc: any) => {
            if (doc.url && doc.name) {
                parsedDocuments.push({
                    name: doc.name,
                    url: doc.url,
                    type: doc.type || (doc.url.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Link'),
                    size: doc.size || 'Xem chi tiết',
                });
            }
        });
    }

    specsList.forEach(spec => {
        const keyLower = spec.key.toLowerCase();
        const valueStr = String(spec.value).trim();
        const isDocKey = keyLower.includes('tài liệu') || keyLower.includes('hướng dẫn') || keyLower.includes('bản vẽ') || keyLower.includes('catalogue') || keyLower.includes('pdf');
        
        if (isDocKey && valueStr.startsWith('http')) {
            parsedDocuments.push({
                name: spec.key,
                url: valueStr,
                type: valueStr.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Link',
                size: 'Xem chi tiết',
            });
        }
    });

    if (parsedDocuments.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 space-y-3 border-t border-stone-100 pt-6">
            <h3 className="text-base font-semibold text-stone-900 mb-3">Tài liệu đính kèm</h3>
            <div className="flex flex-col gap-3">
                {parsedDocuments.map((doc, idx) => (
                    <a 
                        key={idx} 
                        href={doc.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="group flex items-start gap-4 p-4 rounded-xl border border-stone-200 bg-white hover:border-brand-300 hover:shadow-md transition-all duration-200"
                    >
                        <div className="w-10 h-10 rounded-lg bg-stone-100 text-stone-500 group-hover:bg-brand-50 group-hover:text-brand-600 flex items-center justify-center shrink-0 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div className="flex flex-col gap-1">
                            <h4 className="text-sm font-semibold text-stone-900 group-hover:text-brand-600 line-clamp-2 transition-colors">
                                {doc.name}
                            </h4>
                            <p className="text-xs text-stone-500 uppercase tracking-wider font-medium">
                                {doc.type || 'PDF'} • {doc.size || 'Tải xuống'}
                            </p>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}
