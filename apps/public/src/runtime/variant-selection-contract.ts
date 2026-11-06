export type SnapshotVariantAxis={key:'size'|'seat_type';label:string}
export type SnapshotVariantOption={axis:'size'|'seat_type';value:string;label:string}

export type SnapshotVariantMember={
  id:number
  variant_group?:string
  variant_type?:'size'|'seat_type'
  variant_label?:string
  variant_options:SnapshotVariantOption[]
}

export type SnapshotVariantSelection<T extends SnapshotVariantMember>={
  axes:SnapshotVariantAxis[]
  currentVariantOptions:SnapshotVariantOption[]
  siblings:T[]
}

const EMPTY_SELECTION:SnapshotVariantSelection<SnapshotVariantMember>={
  axes:[],currentVariantOptions:[],siblings:[],
}

export function selectSnapshotVariantData<T extends SnapshotVariantMember>(
  group:string,
  currentId:number,
  members:unknown,
  axes:unknown,
):SnapshotVariantSelection<T>{
  if(!/^public-[1-9][0-9]*$/.test(group)||!Number.isSafeInteger(currentId)
    ||!Array.isArray(members)||members.length<2||members.length>8
    ||!Array.isArray(axes)||axes.length!==1)return EMPTY_SELECTION as SnapshotVariantSelection<T>

  const axis=axes[0] as SnapshotVariantAxis|undefined
  if(!axis||!['size','seat_type'].includes(axis.key)||typeof axis.label!=='string'
    ||axis.label.trim()!==axis.label||axis.label.length<1||axis.label.length>80)return EMPTY_SELECTION as SnapshotVariantSelection<T>

  const typedMembers=members as T[]
  const currentMatches=typedMembers.filter(member=>member?.id===currentId)
  const ids=new Set<number>()
  const values=new Set<string>()
  const valid=typedMembers.every(member=>{
    if(!Number.isSafeInteger(member?.id)||member.id<1||ids.has(member.id)
      ||member.variant_group!==group||member.variant_type!==axis.key
      ||typeof member.variant_label!=='string'||!member.variant_label.trim()
      ||member.variant_label.length>100||member.variant_label.trim()!==member.variant_label
      ||!Array.isArray(member.variant_options)||member.variant_options.length!==1)return false
    const option=member.variant_options[0]
    const value=option?.value
    if(option?.axis!==axis.key||typeof value!=='string'||!value.trim()||value.length>100
      ||value.trim()!==value||option.label!==member.variant_label)return false
    const normalized=value.toLocaleLowerCase('vi')
    if(values.has(normalized))return false
    ids.add(member.id)
    values.add(normalized)
    return true
  })
  if(!valid||currentMatches.length!==1)return EMPTY_SELECTION as SnapshotVariantSelection<T>

  const current=currentMatches[0]
  return {
    axes:[axis],
    currentVariantOptions:current.variant_options,
    siblings:typedMembers.filter(member=>member.id!==currentId),
  }
}
