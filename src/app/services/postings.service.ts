import {Injectable} from '@angular/core';
import {HttpService} from './http.service';
import {Observable} from 'rxjs/Observable';
import {finalize} from 'rxjs/operators';
import {PostingSerializer} from '../serializers/posting.serializer';
import {Posting, PostingStatus} from '../models/posting';
import {ResourceService} from './resource.service';
import {MessageBus} from './message-bus';
import {UserMustUpdate} from '../models/message-bus-events/user-must-update';
import 'rxjs/add/operator/finally';
import {AuthService} from './auth.service';
import {PostingsUpdated} from 'app/models/message-bus-events/postings-updated';
import {UploaderService} from './uploader.service';
import {PostingFetched} from '../models/message-bus-events/posting-fetched';

@Injectable()
export class PostingsService extends ResourceService<Posting> {
  private applyUrl = 'postings/apply';
  private unApplyUrl = 'postings/unapply';
  private postingsUrl = 'postings';

  constructor(httpService: HttpService,
              private authService: AuthService,
              private uploaderService: UploaderService,
              private messageBus: MessageBus) {
    super(
      httpService,
      'postings', // TODO must call this somehow
      new PostingSerializer()
    );
  }

  /**
   * Creates a posting, uploads an images and links them together.
   * @param posting
   * @param file
   * @param success
   * @param error
   */
  createWithFile(posting: Posting, file: File, success, error) {
    // Create the promise
    const creationPromise = super.create(posting);

    if (file == null) {
      creationPromise.subscribe(success, error);
    } else {
      // If the file was provided, POST the file and bind it to the user
      creationPromise.subscribe((success_data) => {
        this.uploaderService.upload(file, success_data._id, this.uploaderService.postingKey).subscribe((data) => {
          posting.photo = data;
          success();
        }, error);
      });
    }
  }

  /**
   * Makes a request to mark the user as an applicant for the posting.
   * @param postingId - the posting id where the user applies to
   */
  userAppliesForPosting(postingId): Observable<any> {
    return this.httpService
      .post(this.applyUrl, {posting_id: postingId})
      .pipe(finalize(() => {
      this.messageBus.publish(new UserMustUpdate());
    }));
  }

  /**
   * Returns a promise that will update the status of the posting.
   * @param postingId
   * @param status
   */
  updatePostingStatus(postingId: string, status: PostingStatus): Observable<any> {
    return this.httpService.update(this.postingsUrl, postingId, { status: status.toString() });
  }

  /**
   * Makes a request to mark delete the user from the applicant list for the posting.
   * @param postingId - the posting id where the user should be deleted from
   */
  userUnAppliesForPosting(postingId): Observable<any> {
    return this.httpService.post(this.unApplyUrl, {posting_id: postingId}).pipe(finalize(() => {
      this.messageBus.publish(new UserMustUpdate());
    }));
  }

  fetchPosting(id) {
    super.read(id).subscribe((success_data) => {
      this.messageBus.publish(new PostingFetched(success_data));
    });
  }

  fetchPostings() {
    super.list().subscribe((success_data) => {
      this.messageBus.publish(new PostingsUpdated(success_data));
    });
  }
}
