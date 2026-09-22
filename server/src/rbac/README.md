# RBAC — kako se koristi

```ts
@Controller('kyc')
export class KycController {
  // samo Support/Team Lead/Admin
  @Get('queue')
  @RequirePermission(PERMISSIONS.KYC_QUEUE_READ)
  queue() { /* ... */ }

  // otvaranje dokumenta: permisija + automatski audit (AUDITED_PERMISSIONS)
  @Get('document/:id')
  @RequirePermission(PERMISSIONS.KYC_DOCUMENT_VIEW)
  document(@Param('id') id: string) { /* ... */ }

  // korisnik vidi svoj predmet; tuđi samo uz permisiju
  @Get('case/:userId')
  @SelfOr(PERMISSIONS.KYC_QUEUE_READ, 'userId')
  myCase(@Param('userId') userId: string) { /* ... */ }

  // javno
  @Get('requirements')
  @Public()
  requirements() { /* ... */ }
}
```

## Tri pravila

1. **Zatvoreno po defaultu.** Ruta bez `@Public()` ili `@RequirePermission()` vraća
   403 i loguje grešku. Zaboravljen dekorator ne može proizvesti otvoren endpoint.
2. **Nikad ne provjeravaj ime uloge u kodu.** Uvijek permisiju. Uloge se mijenjaju
   (danas 7 operatera, sutra 20 i nova smjena); permisije su stabilne.
3. **Baza provjerava isto još jednom.** `has_permission()` u RLS politikama znači da
   direktan poziv PostgREST-a mimo ovog servisa ne prolazi. Guard je udobnost i
   brzina, RLS je stvarna odbrana.

## Ko šta smije (sažetak)

| | Support (7) | Team Lead | HR | IT | Admin |
|---|---|---|---|---|---|
| KYC red i odluke | ✅ | ✅ | ❌ | ❌ | ✅ |
| Lični dokument | ✅ (uz audit) | ✅ (uz audit) | ❌ | ❌ | ✅ |
| Potvrda strajka | ✅ | ✅ | ❌ | ❌ | ✅ |
| Poništenje strajka | ❌ | ✅ | ❌ | ❌ | ✅ |
| Povrat nakon isplate | ❌ | ✅ | ❌ | ❌ | ✅ |
| Vidi proviziju | ❌ | ✅ | ❌ | ❌ | ✅ |
| Interni nalozi | ❌ | ❌ | ✅ | ❌ | ✅ |
| Sistem i logovi | ❌ | ❌ | ❌ | ✅ | ✅ |

Support namjerno NE vidi proviziju i NE može vratiti novac — to su dvije najčešće
tačke zloupotrebe u podršci.
