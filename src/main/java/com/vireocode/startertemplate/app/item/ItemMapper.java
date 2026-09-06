package com.vireocode.startertemplate.app.item;

import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.mapstruct.ReportingPolicy;

import com.vireocode.vireo.base.BaseRequestMapper;
import com.vireocode.vireo.base.JsonNullableMapper;

@Mapper(uses = JsonNullableMapper.class, unmappedTargetPolicy = ReportingPolicy.IGNORE, componentModel = "spring")
public interface ItemMapper extends BaseRequestMapper<Item, ItemCreateRequest, ItemPatchRequest, ItemResponse> {

    @Override
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "version", ignore = true)
    Item toDomain(ItemCreateRequest request);

    @Override
    ItemResponse toResponse(Item domain);

    @Override
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "version", ignore = true)
    void patch(ItemPatchRequest patch, @MappingTarget Item destination);
}
