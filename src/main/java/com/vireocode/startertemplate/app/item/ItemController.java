package com.vireocode.startertemplate.app.item;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.vireocode.vireo.queryengine.QueryFilterRequest;
import com.vireocode.vireo.web.RestUtils;
import com.vireocode.vireo.web.SearchablePageable;
import com.vireocode.startertemplate.app.auth.AppSecurityExpressions;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/items")
public class ItemController {

    private final ItemService service;

    public ItemController(ItemService service) {
        this.service = service;
    }

    @PostMapping("/search")
    @PreAuthorize(AppSecurityExpressions.CAN_READ_ITEMS)
    public Page<ItemResponse> search(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "rowsPerPage", defaultValue = "10") int rowsPerPage,
            @RequestParam(name = "sortBy", defaultValue = "name") String sortBy,
            @RequestParam(name = "sortDirection", defaultValue = "asc") String sortDirection,
            @RequestParam(name = "searchText", required = false) String searchText,
            @RequestBody(required = false) QueryFilterRequest filters) {
        SearchablePageable pageable = RestUtils.makePageable(page, rowsPerPage, sortBy, sortDirection, searchText);
        return service.findAll(pageable, filters);
    }

    @PostMapping
    @PreAuthorize(AppSecurityExpressions.CAN_MANAGE_ITEMS)
    @ResponseStatus(HttpStatus.CREATED)
    public ItemResponse create(@Valid @RequestBody ItemCreateRequest item) {
        return service.create(item);
    }

    @PatchMapping("/{id}")
    @PreAuthorize(AppSecurityExpressions.CAN_MANAGE_ITEMS)
    public ItemResponse patch(@PathVariable("id") UUID id, @Valid @RequestBody ItemPatchRequest item) {
        return service.patch(id, item);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(AppSecurityExpressions.CAN_MANAGE_ITEMS)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable("id") UUID id, @Valid @RequestBody ItemDeleteRequest request) {
        service.deleteWithVersion(id, request.version());
    }
}
